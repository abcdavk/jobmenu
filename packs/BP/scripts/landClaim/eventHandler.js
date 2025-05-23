import { system, world } from "@minecraft/server";
import { Expired, Protection } from "./landClaim";
import { ActionFormData } from "@minecraft/server-ui";
import { handleAddFriendUI, handleRemoveFriendUI, handleSettingUI, handleShowAllFriendUI } from "./UIHandler";
// const PROTECTION_SIZES = {
//   "25": 12,
//   "50": 25,
//   "75": 37,
//   "100": 50,
//   "250": 125
// } as const;
// type ProtectionSizeKey = keyof typeof PROTECTION_SIZES;
// function getProtectionRadius(size: string): number | undefined {
//   return PROTECTION_SIZES[size as ProtectionSizeKey];
// }
export function handlePlaceProtectionBlock(data) {
    let { dimension, permutationBeingPlaced, block, player } = data;
    const protectionSize = parseInt(permutationBeingPlaced.type.id.split("_")[2]);
    new Protection().init(player, block, protectionSize);
    new Expired().init(player, block);
    dimension.spawnEntity("lc:protection_block", block.center());
    console.log("Protection size: ", protectionSize);
}
export function handleBreakProtectionBlock(data) {
    let { dimension, block, player } = data;
    const entities = dimension.getEntities({
        type: "lc:protection_block",
        location: block.center()
    });
    entities.forEach(protectionEntity => {
        // console.log("Removing protection entity, size: ", protectionEntity.getDynamicProperty("lc:protection_size"))
        const protection = new Protection();
        const expired = new Expired();
        const protectionData = protection.get(block);
        if (protectionData === undefined)
            return;
        if (protectionData.nameTag === player.nameTag) {
            protection.remove(block);
            expired.remove(block);
            protectionEntity.remove();
        }
    });
}
export function handleInteractProtectionBlock(data) {
    let { block, player, } = data;
    const dimension = world.getDimension(player.dimension.id);
    const protectionData = new Protection().get(block);
    if (protectionData.nameTag === player.nameTag) {
        let form = new ActionFormData()
            .title('§f§0§1§r§l§0Protection Block Menu')
            .button('Add Friend')
            .button('Remove Friend')
            .button('Show All Friends')
            .button('Settings');
        form.show(player).then(res => {
            if (res.selection === 0) {
                system.run(() => { handleAddFriendUI(player, block, dimension, protectionData); });
            }
            if (res.selection === 1) {
                system.run(() => { handleRemoveFriendUI(player, block, dimension, protectionData); });
            }
            if (res.selection === 2) {
                system.run(() => { handleShowAllFriendUI(player, block, dimension, protectionData); });
            }
            if (res.selection === 3) {
                system.run(() => { handleSettingUI(player, block, dimension, protectionData); });
            }
        });
    }
}
