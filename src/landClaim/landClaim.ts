import { Block, Dimension, Entity, Player, system, Vector3, world } from "@minecraft/server";
import { handleBreakProtectionBlock, handleInteractProtectionBlock, handlePlaceProtectionBlock } from "./eventHandler";
import { ProtectionData } from "./interfaces";

// ================Begin-Initialization================

world.afterEvents.playerSpawn.subscribe(({
  player
}) => {
  console.log("spawning ", player.nameTag);
  if (world.getDynamicProperty("lc:protection_data") !== undefined) return;
  world.setDynamicProperty("lc:protection_data", JSON.stringify([]));

});

// ================End-Initialization================
// , checkOwnerShip: boolean
function isPlayerInArea(player: Player, block: Block) {
  const dimension = block.dimension;
  const protectionBlocks = dimension.getEntities({ type: "lc:protection_block" });

  let inArea: boolean = false;

  for (const protection of protectionBlocks) {
    const protectionBlock = dimension.getBlock(protection.location);
    if (!protectionBlock) continue;

    const protectionData = new Protection(player, protectionBlock, dimension).get();
    const center = protection.location;
    const placed = block.location;

    const half = protectionData.protectionSize / 2;

    const minX = center.x - half;
    const maxX = center.x + half;
    const minZ = center.z - half;
    const maxZ = center.z + half;

    const isInsideX = placed.x >= minX && placed.x < maxX;
    const isInsideZ = placed.z >= minZ && placed.z < maxZ;

    const isOwner = protectionData.nameTag === player.nameTag;
    const friendList = protectionData.allowList ?? [];
    const isFriend = friendList.some(entry => entry.nameTag === player.nameTag);

    if (isInsideX && isInsideZ) {
      // Kalau bukan owner dan bukan friend => dilarang
      if (!isOwner && !isFriend) {
        inArea = true;
      }
    }
  }
  return inArea
}

const playerCooldowns = new Map<string, number>();

world.beforeEvents.playerPlaceBlock.subscribe((data) => {
  const { player, block, permutationBeingPlaced } = data;
  const isProtectionBlock = permutationBeingPlaced.type.id.includes("lc:protection_block");

  if (isPlayerInArea(player, block)) {
    // Cancel if player is not owner
    //if (protectionData.nameTag !== player.nameTag) {
      data.cancel = true;
      // player.sendMessage("§cYou can place block in other player plot.");
      return;
    //}
  }

  // If player placing protection block
  if (isProtectionBlock) {
    system.run(() => handlePlaceProtectionBlock(data));
  }
});


world.beforeEvents.playerBreakBlock.subscribe((data) => {
  let { player, block } = data;
  let isProtectionBlock = block.typeId.includes("lc:protection_block")
  if (isPlayerInArea(player, block)) {
    // Cancel if player is not owner
    // if (protectionData.nameTag !== player.nameTag) {
      data.cancel = true;
      // player.sendMessage("§cYou can't break this block.");
      return;
    // }
  }

  if (isProtectionBlock) {
    console.log("Breaking protection block");
    system.run(() => handleBreakProtectionBlock(data));
  }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {
  let { block, player } = data;
  if (isPlayerInArea(player, block)) {
    // Cancel if player is not owner
    //if (protectionData.nameTag !== player.nameTag) {
      data.cancel = true;
      return;
    //}
  }

  const now = Date.now();
  const lastUsed = playerCooldowns.get(player.id) ?? 0;
  if (now - lastUsed < 260) return;

  playerCooldowns.set(player.id, now);
  let isProtectionBlock = block.typeId.includes("lc:protection_block");
  if (isProtectionBlock) {
    system.run(() => handleInteractProtectionBlock(data));
  }
});

// ==========detect player in area==========
system.runInterval(() => {
  const allPlayers = world.getPlayers();
  const playersInAreaSet = new Set<string>();

  allPlayers.forEach(player => {
    const dimension = world.getDimension(player.dimension.id);
    const protectionEntities = dimension.getEntities({ type: "lc:protection_block" });
    try {
      protectionEntities.forEach(protectionEntity => {
        const block = dimension.getBlock(protectionEntity.location);
        if (!block) return;
  
        const protectionData = new Protection(player, block, dimension).get();
  
        const playersInArea = dimension.getEntities({
          location: protectionEntity.location,
          type: "minecraft:player",
          maxDistance: protectionData.protectionSize / 2
        }) as Player[];
  
        playersInArea.forEach(playerInArea => {
          playerInArea.addTag("lc:inarea");
          playersInAreaSet.add(playerInArea.name);
        });
      });
    } catch (err) {
      
    }
  });

  // Remove tag from players not in any area
  world.getPlayers().forEach(player => {
    if (!playersInAreaSet.has(player.name)) {
      if (player.hasTag("lc:inarea")) {
        player.removeTag("lc:inarea");
      }
    }
  });
});


// ==========show boundaries========
system.runInterval(() => {
  world.getPlayers().forEach(player => {
    const dimension = world.getDimension(player.dimension.id);
    dimension.getEntities({ type: "lc:protection_block" }).forEach(protectionEntity => {
      const block = dimension.getBlock(protectionEntity.location);

      if (block === undefined) return;
      const protectionData = new Protection(player, block, dimension).get();
      if (protectionData === undefined) return;
      if (!protectionData.settings.showBoundaries) return;
      const loc = protectionEntity.location;


      const radius = protectionData.protectionSize / 2;
      if (radius !== undefined) {
        const step = 2;
        const y = loc.y;
        const delay = 1;

        const delayedSpawn = (x: number, y: number, z: number, delayTicks: number) => {
          system.runTimeout(() => {
            try {
              dimension.spawnParticle("lc:selection_draw", { x, y, z });
            } catch (err) {
              
            }
          }, delayTicks);
        }

        let tickCounter = 0;

        for (let x = loc.x - radius; x <= loc.x + radius; x += step) {
          delayedSpawn(x, y, loc.z - radius, tickCounter++);
          delayedSpawn(x, y, loc.z + radius, tickCounter++);
        }
      
        for (let z = loc.z - radius; z <= loc.z + radius; z += step) {
          delayedSpawn(loc.x - radius, y, z, tickCounter++);
          delayedSpawn(loc.x + radius, y, z, tickCounter++);
        }
      }
    });
  });
}, 20);

export class Protection {
  private player: Player;
  private block: Block;
  private dimension: Dimension;
  private defaultPlotName: string
  
  constructor(player: Player, block: Block, dimension: Dimension) {
    this.player = player;
    this.block = block;
    this.dimension = dimension;

    this.defaultPlotName = `${player.nameTag}'s plot`
  }

  private getProtectionData(): ProtectionData[] {
    const rawData = world.getDynamicProperty("lc:protection_data") as string;
    let data = JSON.parse(rawData) as ProtectionData[];
    data = data.filter(d => d && typeof d === "object" && d.nameTag);

    return data;
  }

  debug() {
    const data = this.getProtectionData();
    this.player.sendMessage(`=====================`)
    for (let i = 0; i < data.length; i++) {
      this.player.sendMessage(`§a${i} - §7${JSON.stringify(data[i])}`);
      // console.log(`§a${i} - §7${JSON.stringify(data[i])}`)
    }
  }

  init(protectionSize: number) {
    const protection_data: ProtectionData = {
      nameTag: this.player.nameTag,
      location: this.block.center(),
      protectionSize: protectionSize,
      settings: {
        plotName: this.defaultPlotName,
        showBoundaries: true
      },
      allowList: []
    }

    let data = this.getProtectionData();

    data.push(protection_data);
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));

    console.log(JSON.stringify(protection_data));
    this.debug();
  }

  remove() {
    let data = this.getProtectionData();
    data = data.filter(protectionData => {
      return !(
        protectionData.location.x === this.block.center().x &&
        protectionData.location.y === this.block.center().y &&
        protectionData.location.z === this.block.center().z
      );
    });
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
    console.log("removing data: ", JSON.stringify(this.block.center()))
  }

  get() {
    let data = this.getProtectionData();
    data = data.filter(protectionData => {
      return (
        protectionData.location.x === this.block.center().x &&
        protectionData.location.y === this.block.center().y &&
        protectionData.location.z === this.block.center().z
      );
    });
    return data[0];
  }

  set(value: ProtectionData) {
    this.remove();

    const data = this.getProtectionData();
    data.push(value);
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
  }
}

system.afterEvents.scriptEventReceive.subscribe((data) => {
  if (data.id === "lc:setting") {
    if (data.message === "reset") {
      world.setDynamicProperty("lc:protection_data", JSON.stringify([]));
    }
    if (data.message === "get") {
      const data = world.getDynamicProperty("lc:protection_data") as string;
      console.log(data)
    }
  }
});