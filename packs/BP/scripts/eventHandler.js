import { Protection } from "./landClaim";
const PROTECTION_SIZES = {
    "25": 12,
    "50": 25,
    "75": 37,
    "100": 50,
    "250": 125
};
function getProtectionRadius(size) {
    return PROTECTION_SIZES[size];
}
export function handlePlaceProtectionBlock(data) {
    let { dimension, permutationBeingPlaced, block, player } = data;
    const protectionSize = parseInt(permutationBeingPlaced.type.id.split("_")[2]);
    let protectionEntity = dimension.spawnEntity("lc:protection_block", block.center());
    new Protection(player, block, dimension).init(protectionSize);
    console.log("Protection size: ", protectionSize);
}
export function handleBreakProtectionBlock(data) {
    let { dimension, block } = data;
    const entities = dimension.getEntities({
        type: "lc:protection_block",
        location: block.center()
    });
    entities.forEach(protectionEntity => {
        // console.log("Removing protection entity, size: ", protectionEntity.getDynamicProperty("lc:protection_size"))
        protectionEntity.remove();
    });
}
