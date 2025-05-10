import { system, world } from "@minecraft/server";
import { handleBreakProtectionBlock, handlePlaceProtectionBlock } from "./eventHandler";
// ================Begin-Initialization================
world.afterEvents.playerSpawn.subscribe(({ player }) => {
    console.log("spawning ", player.nameTag);
    if (world.getDynamicProperty("lc:protection_data") !== undefined)
        return;
    world.setDynamicProperty("lc:protection_data", JSON.stringify([]));
});
// ================End-Initialization================
world.beforeEvents.playerPlaceBlock.subscribe((data) => {
    let { player, permutationBeingPlaced, block } = data;
    let isProtectionBlock = permutationBeingPlaced.type.id.includes("lc:protection_block");
    if (isProtectionBlock) {
        console.log("Placing protection block");
        system.run(() => handlePlaceProtectionBlock(data));
    }
});
world.beforeEvents.playerBreakBlock.subscribe((data) => {
    let { player, block } = data;
    let isProtectionBlock = block.typeId.includes("lc:protection_block");
    if (isProtectionBlock) {
        console.log("Breaking protection block");
        system.run(() => handleBreakProtectionBlock(data));
    }
});
export class Protection {
    constructor(player, block, dimension) {
        this.player = player;
        this.block = block;
        this.dimension = dimension;
        this.defaultPlotName = `${player.nameTag}'s plot`;
    }
    getProtectionData() {
        const data = world.getDynamicProperty("lc:protection_data");
        return JSON.parse(data);
    }
    init(protectionSize) {
        const protection_data = {
            nameTag: this.player.nameTag,
            plotName: this.defaultPlotName,
            location: this.block.center(),
            protectionSize: protectionSize,
            allowList: []
        };
        let data = this.getProtectionData();
        data.push(protection_data);
        world.setDynamicProperty("lc:protection_data", JSON.stringify(data));
        console.log(JSON.stringify(protection_data));
    }
}
