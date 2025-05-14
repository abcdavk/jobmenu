import { Block, Dimension, Entity, EntityComponentTypes, Player, system, Vector3, world } from "@minecraft/server";
import { handleBreakProtectionBlock, handleInteractProtectionBlock, handlePlaceProtectionBlock } from "./eventHandler";
import { AllowList, ExpiredDate, ProtectionData } from "./interfaces";
import { ActionFormData } from "@minecraft/server-ui";


export class Expired {
  private key = "lc:expired";

  private getAllExpiredDate(): ExpiredDate[] {
    const raw = world.getDynamicProperty(this.key) as string;
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ExpiredDate[];
    } catch {
      return [];
    }
  }

  private saveAllExpiredDate(data: ExpiredDate[]) {
    world.setDynamicProperty(this.key, JSON.stringify(data));
  }

  /** Expired 12 days from now */
  init(player: Player, block: Block) {
    const now = Date.now();
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const expiredAt = now + twoWeeks;

    const newEntry: ExpiredDate = {
      location: block.location, // atau block.center() jika perlu presisi
      date: expiredAt,
      nameTag: player.nameTag
    };

    const currentData = this.getAllExpiredDate();

    
    const index = currentData.findIndex(entry =>
      entry.location.x === newEntry.location.x &&
      entry.location.y === newEntry.location.y &&
      entry.location.z === newEntry.location.z
    );

    if (index !== -1) {
      currentData[index] = newEntry;
    } else {
      currentData.push(newEntry);
    }

    this.saveAllExpiredDate(currentData);
  }

  /** Update expired date */
  update(player: Player) {
    const now = Date.now();
    const twoWeeks = 14 * 24 * 60 * 60 * 1000;
    const newExpireTime = now + twoWeeks;

    const currentData = this.getAllExpiredDate();

    const updatedData = currentData.map(entry => {
      if (entry.nameTag === player.nameTag) {
        return {
          ...entry,
          date: newExpireTime
        };
      }
      return entry;
    });

    this.saveAllExpiredDate(updatedData);
  }


  /** Get all data */
  getAll(): ExpiredDate[] {
    return this.getAllExpiredDate();
  }

  /** Remove expired data */
  removeExpired() {
    const now = Date.now();
    const current = this.getAllExpiredDate();
    const filtered = current.filter(entry => entry.date > now);
    this.saveAllExpiredDate(filtered);
  }

  /** Remove specific expired data */
  remove(block: Block) {
    const current = this.getAllExpiredDate();
    const entry = current.filter(e => {
      return !(e.location.x === block.location.x &&
      e.location.y === block.location.y &&
      e.location.z === block.location.z)
    });
    console.log(`removing expired data: ${JSON.stringify(block.center())}`)
    this.saveAllExpiredDate(entry);
  }

  /** Check location is expired */
  isExpired(block: Block): boolean {
    const now = Date.now();
    const current = this.getAllExpiredDate();
    const entry = current.find(e =>
      e.location.x === block.location.x &&
      e.location.y === block.location.y &&
      e.location.z === block.location.z
    );
    return entry ? entry.date <= now : false;
  }

  /** Get total expired blocks owned by player */
  getPlayerExpiredLength(player: Player): number {
    const currentData = this.getAllExpiredDate();
    return currentData.filter(entry => entry.nameTag === player.nameTag).length;
  }
}


// ================Begin-Initialization================

world.afterEvents.playerSpawn.subscribe(({
  player
}) => {
  console.log("spawning ", player.nameTag);
  if (world.getDynamicProperty("lc:protection_data") === undefined) {
    world.setDynamicProperty("lc:protection_data", JSON.stringify([]));
    world.setDynamicProperty("lc:expired", JSON.stringify([]));
  };
  new Expired().update(player);
});

// ================End-Initialization================

function getPlayerProtectionData(player: Player, origin: Block | Entity) {
  const { dimension } = origin;
  const protectionBlocks = dimension.getEntities({ type: "lc:protection_block" });

  for (const protection of protectionBlocks) {
    const protectionBlock = dimension.getBlock(protection.location);
    if (!protectionBlock) continue;

    const protectionData = new Protection().get(protectionBlock);
    if (!protectionData) continue;

    const { x: cx, z: cz } = protection.location;
    const { x: px, z: pz } = origin.location;
    const half = protectionData.protectionSize / 2;

    const isInside =
      px >= cx - half && px < cx + half &&
      pz >= cz - half && pz < cz + half;

    if (!isInside) continue;

    const isOwner = protectionData.nameTag === player.nameTag;
    const allowList = protectionData.allowList ?? [];

    const matchedFriend = allowList.find(friend => friend.nameTag === player.nameTag);

    const defaultPermission: AllowList = {
      nameTag: player.nameTag,
      allow_place_block: false,
      allow_break_block: false,
      allow_interact_with_block: false,
      allow_tnt: false,
      allow_button: false,
      allow_lever: false,
      allow_interact_armor_stand: false,
      allow_attack_animals: false,
      allow_attack_players: false
    };

    return {
      isOwner,
      isFriend: !!matchedFriend,
      allowList: matchedFriend ?? defaultPermission
    };
  }

  return {
    isOwner: true,
    isFriend: true,
    allowList: {
      nameTag: "",
      allow_place_block: true,
      allow_break_block: true,
      allow_interact_with_block: true,
      allow_tnt: true,
      allow_button: true,
      allow_lever: true,
      allow_interact_armor_stand: true,
      allow_attack_animals: true,
      allow_attack_players: true
    } as AllowList
  };
}

const playerCooldowns = new Map<string, number>();

world.beforeEvents.playerPlaceBlock.subscribe((data) => {
  const { player, block, permutationBeingPlaced } = data;
  const isProtectionBlock = permutationBeingPlaced.type.id.includes("lc:protection_block");

  const { isOwner, allowList } = getPlayerProtectionData(player, block);
  if (!isOwner && !allowList.allow_place_block) {
    data.cancel = true;
    return;
  }

  // If player placing protection block
  const expiredLength = new Expired().getPlayerExpiredLength(player);
  console.log(expiredLength)
  if (isProtectionBlock) {
    if (expiredLength <= 10) {
      system.run(() => handlePlaceProtectionBlock(data));
    } else {
      data.cancel = true;
      player.sendMessage('§cMax block protection reached!')
    }
  }
});


world.beforeEvents.playerBreakBlock.subscribe((data) => {
  let { player, block } = data;
  let isProtectionBlock = block.typeId.includes("lc:protection_block")
  
  const { isOwner, allowList } = getPlayerProtectionData(player, block);
  if (!isOwner && !allowList.allow_break_block) {
    data.cancel = true;
    return;
  }

  if (isProtectionBlock) {
    console.log("Breaking protection block");
    system.run(() => handleBreakProtectionBlock(data));
  }
});

world.beforeEvents.playerInteractWithBlock.subscribe((data) => {
  let { block, player, itemStack } = data;
  
  const { isOwner, allowList } = getPlayerProtectionData(player, block);
  if (!isOwner) {
    const id = block.typeId.toLowerCase();

    const permissionChecks: { keywords: string[]; permission: keyof AllowList }[] = [
      { keywords: ["button"], permission: "allow_button" },
      { keywords: ["tnt"], permission: "allow_tnt" },
      { keywords: ["lever"], permission: "allow_lever" },
    ];

    let matched = false;

    for (const check of permissionChecks) {
      if (check.keywords.some(keyword => id.includes(keyword))) {
        matched = true;
        if (!allowList[check.permission]) {
          data.cancel = true;
          return;
        }
      }
    }

    if (!matched) {
      const generalInteractKeywords = [
        "craft", "table", "anvil", "stand", "grind", "furnace", "smoker",
        "chest", "barrel", "sign", "frame", "beacon", "dropper",
        "dispenser", "hopper", "loom"
      ];
      if (generalInteractKeywords.some(keyword => id.includes(keyword))) {
        if (!allowList.allow_interact_with_block) {
          data.cancel = true;
          return;
        }
      }
    }
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

world.beforeEvents.playerInteractWithEntity.subscribe((data) => {
  let { player, target } = data;
  const { isOwner, allowList } = getPlayerProtectionData(player, target);
  if (!isOwner && target.typeId === "minecraft:armor_stand" && !allowList.allow_interact_with_block) {
    data.cancel = true;
    return;
  }
});

world.beforeEvents.explosion.subscribe((data) => {
  let { source: explosionEntity, dimension } = data;
  if (!explosionEntity) return;
  const protectionEntities = dimension.getEntities({ type: "lc:protection_block" });

  for (const protectionEntity of protectionEntities) {
    const protectionBlock = dimension.getBlock(protectionEntity.location);
    if (!protectionBlock) continue;

    const protectionData = new Protection().get(protectionBlock);
    if (!protectionData) continue;

    const { x: cx, z: cz } = protectionEntity.location;
    const { x: px, z: pz } = explosionEntity.location;
    const half = protectionData.protectionSize / 2;

    const isInside =
      px >= cx - half && px < cx + half &&
      pz >= cz - half && pz < cz + half;
      
    if (!isInside) continue;
    if (explosionEntity.typeId === "minecraft:tnt" && protectionData.settings.anti_tnt) {
      data.cancel = true;
    }
    if (explosionEntity.typeId === "minecraft:creeper" && protectionData.settings.anti_creeper) {
      data.cancel = true;
    }
  }
});

// ==========detect entity in area==========
system.runInterval(() => {
  const allPlayers = world.getPlayers();

  allPlayers.forEach(player => {
    const dimension = player.dimension;
    const protectionEntities = dimension.getEntities({ type: "lc:protection_block" });

    for (const protectionEntity of protectionEntities) {
      const protectionBlock = dimension.getBlock(protectionEntity.location);
      if (!protectionBlock) continue;

      const protectionData = new Protection().get(protectionBlock);
      if (!protectionData) continue;
      dimension.getEntities().forEach(entity => {
        const { x: cx, z: cz } = protectionEntity.location;
        const { x: px, z: pz } = entity.location;
        const half = protectionData.protectionSize / 2;
  
        const isInside =
          px >= cx - half && px < cx + half &&
          pz >= cz - half && pz < cz + half;
          
        if (isInside) {
          if (entity.typeId === "minecraft:splash_potion" && protectionData.settings.anti_splash_potion) {
            entity.remove();
          }
          if (entity.typeId === "minecraft:arrow" && protectionData.settings.anti_arrow) {
            entity.remove();
          }
          if (entity.getComponent(EntityComponentTypes.TypeFamily)?.hasTypeFamily("monster") && protectionData.settings.anti_hostile) {
            entity.remove();
          }
        }
      })
    }
  });
});

// ==========detect player in area==========
system.runInterval(() => {
  const allPlayers = world.getPlayers();

  allPlayers.forEach(player => {
    const dimension = player.dimension;
    const protectionEntities = dimension.getEntities({ type: "lc:protection_block" });

    let isInProtectedArea = false;
    let isOwner = false;
    let allowAttackPlayers = true;
    let allowAttackAnimals = true;
    let antiHostile = false

    for (const protectionEntity of protectionEntities) {
      const protectionBlock = dimension.getBlock(protectionEntity.location);
      if (!protectionBlock) continue;

      const protectionData = new Protection().get(protectionBlock);
      if (!protectionData) continue;

      const { x: cx, z: cz } = protectionEntity.location;
      const { x: px, z: pz } = player.location;
      const half = protectionData.protectionSize / 2;

      const isInside =
        px >= cx - half && px < cx + half &&
        pz >= cz - half && pz < cz + half;
        
      if (!isInside) continue;
      
      isOwner = protectionData.nameTag === player.nameTag;
      
      isInProtectedArea = true;

      allowAttackPlayers = protectionData.allowList.find(f => f.nameTag === player.nameTag)?.allow_attack_players ?? false;
      allowAttackAnimals = protectionData.allowList.find(f => f.nameTag === player.nameTag)?.allow_attack_animals ?? false;
      antiHostile = protectionData.settings.anti_hostile ?? false;
      break;
    }


    if (isInProtectedArea) {
      if (!isOwner) {
        if (!allowAttackPlayers && !player.hasTag("deny_attack_player")) {
          player.addTag("deny_attack_player");
        }
        if (!allowAttackAnimals && !player.hasTag("deny_attack_animals")) {
          player.addTag("deny_attack_animals");
        }
      }
      // if (antiHostile) {
      //   console.log("event triggered")
      //   player.triggerEvent("dave:add_anti_hostile");
      // }
    } else {
      if (player.hasTag("deny_attack_player")) {
        player.removeTag("deny_attack_player");
      }
      if (player.hasTag("deny_attack_animals")) {
        player.removeTag("deny_attack_animals");
      }
      // if (!antiHostile) {
      //   player.triggerEvent("dave:remove_anti_hostile")
      // }
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
      const protectionData = new Protection().get(block);
      const expiredData = new Expired();
      const isExpired = expiredData.isExpired(block);
      if (isExpired) {
        block.setType("minecraft:air");
        protectionEntity.remove();
        new Protection().remove(block);
        expiredData.remove(block)
      }
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
  private getProtectionData(): ProtectionData[] {
    const rawData = world.getDynamicProperty("lc:protection_data") as string;
    let data = JSON.parse(rawData) as ProtectionData[];
    data = data.filter(d => d && typeof d === "object" && d.nameTag);

    return data;
  }

  debug(player: Player) {
    const data = this.getProtectionData();
    player.sendMessage(`=====================`)
    for (let i = 0; i < data.length; i++) {
      player.sendMessage(`§a${i} - §7${JSON.stringify(data[i])}`);
      // console.log(`§a${i} - §7${JSON.stringify(data[i])}`)
    }
  }

  init(player: Player, block: Block, protectionSize: number) {
    const defaultPlotName = `${player.nameTag}'s plot`
    const protection_data: ProtectionData = {
      nameTag: player.nameTag,
      location: block.center(),
      protectionSize: protectionSize,
      settings: {
        plotName: defaultPlotName,
        showBoundaries: true,
        anti_tnt: false,
        anti_creeper: false,
        anti_arrow: false,
        anti_splash_potion: false,
        anti_hostile: false
      },
      allowList: []
    }

    let data = this.getProtectionData();

    data.push(protection_data);
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));

    console.log(JSON.stringify(protection_data));
    this.debug(player);
  }

  remove(block: Block) {
    let data = this.getProtectionData();
    data = data.filter(protectionData => {
      return !(
        protectionData.location.x === block.center().x &&
        protectionData.location.y === block.center().y &&
        protectionData.location.z === block.center().z
      );
    });
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
    console.log("removing data: ", JSON.stringify(block.center()))
  }

  get(block: Block) {
    let data = this.getProtectionData();
    data = data.filter(protectionData => {
      return (
        protectionData.location.x === block.center().x &&
        protectionData.location.y === block.center().y &&
        protectionData.location.z === block.center().z
      );
    });
    return data[0];
  }


  getAll(filter?: string) {
    let rawData = this.getProtectionData();
    if (typeof filter === "string") {
      rawData = rawData.filter(data => {
        return (
          data.nameTag === filter
        );
      });
    } 
    
    return rawData;
  }

  set(block: Block, value: ProtectionData) {
    this.remove(block);

    const data = this.getProtectionData();
    data.push(value);
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
  }
}

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "lc:setting") {
    if (ev.message === "reset") {
      world.setDynamicProperty("lc:protection_data", JSON.stringify([]));
      world.setDynamicProperty("lc:expired", JSON.stringify([]));
    }
    if (ev.message === "get") {
      const data = world.getDynamicProperty("lc:protection_data") as string;
      const exp = world.getDynamicProperty("lc:expired") as string;
      console.log(data);
      console.log(exp);
    }
  }
  if (ev.id === "claim:tp") {
    let message = ev.message;
    let player = ev.sourceEntity as Player;
    if (player?.typeId !== "minecraft:player") return;
    if (message !== "") {
      let rawData = new Protection().getAll();
      if (rawData !== undefined) {
        let form = new ActionFormData()
          .title("§f§0§1§r§l§0TP to Claim Land")
          .body(`Owner: §b${rawData[0].nameTag}`)
        for (let i = 0; i < rawData.length; i++) {
          let { x, y, z } = rawData[i].location;
          form.button(`§r${rawData[i].settings.plotName}\n ${x}, ${y}, ${z}`);
        }
        form.show(player).then(res => {
          if (res.selection !== undefined) {
            let loc = rawData[res.selection].location;
            let plotName = rawData[res.selection].settings.plotName;
            let { x, y, z } = loc

            player.teleport(loc);
            player.sendMessage(`Teleported to ${plotName}.\nOwner: ${rawData[0].nameTag}\nLocation: §a${x}, ${y}, ${z}`)
          }
        });
      }
    } else {
      handleShowAllPlayers(player)
    }
  }
});

function handleShowAllPlayers(player: Player) {
  let rawData = new Protection().getAll();
  let form = new ActionFormData()
   .title("§f§0§1§r§l§0All Players")
  for (let i = 0; i < rawData.length; i++) {
    let { x, y, z } = rawData[i].location;
    form.button(`§r${rawData[i].nameTag}\n ${x}, ${y}, ${z}`);
  }
  form.show(player).then(res => {
    if (res.selection !== undefined) {
      let loc = rawData[res.selection].location;
      let plotName = rawData[res.selection].settings.plotName;
      let { x, y, z } = loc

      player.teleport(loc);
      player.sendMessage(`Teleported to ${plotName}.\nOwner: ${rawData[0].nameTag}\nLocation: §a${x}, ${y}, ${z}`)
    }
  });
}