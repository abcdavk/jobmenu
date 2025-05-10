import { Block, Dimension, Entity, Player, system, Vector3, world } from "@minecraft/server";
import { handleBreakProtectionBlock, handlePlaceProtectionBlock } from "./eventHandler";

// ================Begin-Initialization================

world.afterEvents.playerSpawn.subscribe(({
  player
}) => {
  console.log("spawning ", player.nameTag);
  if (world.getDynamicProperty("lc:protection_data") !== undefined) return;
  world.setDynamicProperty("lc:protection_data", JSON.stringify([]));

});

// ================End-Initialization================

world.beforeEvents.playerPlaceBlock.subscribe((data) => {
  let {
    player,
    permutationBeingPlaced,
    block
  } = data;
  let isProtectionBlock = permutationBeingPlaced.type.id.includes("lc:protection_block")
  if (isProtectionBlock) {
    console.log("Placing protection block");
    system.run(() => handlePlaceProtectionBlock(data));
  }
});

world.beforeEvents.playerBreakBlock.subscribe((data) => {
  let {
    player,
    block
  } = data;
  let isProtectionBlock = block.typeId.includes("lc:protection_block")
  if (isProtectionBlock) {
    console.log("Breaking protection block");
    system.run(() => handleBreakProtectionBlock(data));
  }
});

export class Protection {
  private player: Player;
  private block: Block;
  private dimension: Dimension;
  private defaultPlotName: string
  
  constructor(player: Player, block: Block ,dimension: Dimension) {
    this.player = player;
    this.block = block;
    this.dimension = dimension;

    this.defaultPlotName = `${player.nameTag}'s plot`
  }

  private getProtectionData(): ProtectionData[] {
    const data = world.getDynamicProperty("lc:protection_data") as string;
    return JSON.parse(data)
  }

  init(protectionSize: number) {
    const protection_data: ProtectionData = {
      nameTag: this.player.nameTag,
      plotName: this.defaultPlotName,
      location: this.block.center(),
      protectionSize: protectionSize,
      allowList: []
    }

    const data = this.getProtectionData();
    data.push(protection_data);
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));

    console.log(JSON.stringify(protection_data));
  }

  remove() {
    let data = this.getProtectionData()
    data = data.filter(protectionData => {
      return !(
        protectionData.location.x === this.block.center().x &&
        protectionData.location.y === this.block.center().y &&
        protectionData.location.z === this.block.center().z &&
        protectionData.nameTag === this.player.nameTag
      );
    });
    world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
  }
}

export type AllowList = {
  nameTag: string,
  allow_place_block: boolean,
  allow_break_block: boolean,
  allow_interact_with_block: boolean,
  allow_tnt: boolean,
  allow_button: boolean,
  allow_lever: boolean,
  allow_interact_armor_stand: boolean,
  allow_attack_animals: boolean,
  allow_attack_players: boolean,
}

export interface ProtectionData {
  nameTag: string;
  plotName: string;
  location: Vector3;
  protectionSize: number;
  allowList: AllowList[]
}