import { EntityComponentTypes, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
function calculateNextValue(level, initial, step) {
    if (level < 1)
        return initial;
    return parseFloat((initial + level * step).toFixed(2));
}
let moneyAddMessage = "";
system.runInterval(() => {
    world.getPlayers().forEach(player => {
        let playerMoney = player.getDynamicProperty("job:money");
        let playerJob = player.getDynamicProperty("job:currentJob");
        if (playerJob !== undefined) {
            let { initialRequirement, requirementStep, } = allJobs[playerJob];
            let jobTitle = allJobs[playerJob].title;
            let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
            let jobProgress = player.getDynamicProperty(`job:${jobTitle}_progress`);
            let jobRequirement = calculateNextValue(jobLevel, initialRequirement, requirementStep);
            if (jobProgress >= jobRequirement) {
                console.warn(jobProgress);
                player.setDynamicProperty(`job:${jobTitle}_progress`, 0);
                player.setDynamicProperty(`job:${jobTitle}_level`, jobLevel + 1);
            }
            let moneyAdd = player.getDynamicProperty("job:moneyAdd");
            moneyAddMessage = moneyAdd === undefined ? '' : ` §a+$${moneyAdd}`;
            player.onScreenDisplay.setActionBar(`§eMoney: §r$${playerMoney}${moneyAddMessage}\n\n§cStatus:\n §vJob: §r${jobTitle}\n §bLevel: §r${jobLevel}\n §uProgress: §r${jobProgress}/${jobRequirement}`);
        }
        else {
            player.onScreenDisplay.setActionBar(`§eMoney: §r$${playerMoney}`);
        }
    });
});
function giveReward(player, reward) {
    let playerJob = player.getDynamicProperty("job:currentJob");
    let playerMoney = player.getDynamicProperty("job:money");
    let jobTitle = allJobs[playerJob].title;
    let jobProgress = player.getDynamicProperty(`job:${jobTitle}_progress`);
    player.setDynamicProperty("job:money", parseFloat((playerMoney + reward).toFixed(2)));
    player.setDynamicProperty(`job:${jobTitle}_progress`, jobProgress + 1);
    player.setDynamicProperty("job:moneyAdd", reward);
    let messageTimeout = 80;
    let runId = system.runInterval(() => {
        messageTimeout -= 1;
        if (messageTimeout <= 0) {
            player.setDynamicProperty("job:moneyAdd");
            system.clearRun(runId);
        }
    });
    // player.sendMessage(`§aEarned $${reward}`);
}
const allJobs = [
    {
        initialRequirement: 64,
        requirementStep: 64,
        initialReward: 0.08,
        rewardStep: 0.01,
        description: "Harvest crops to earn money.",
        title: "Farming",
        type: ["break_block"],
        cropBlocks: [
            { id: "minecraft:wheat", state: "growth", value: 7 },
            { id: "minecraft:carrots", state: "growth", value: 7 },
            { id: "minecraft:potatoes", state: "growth", value: 7 },
            { id: "minecraft:beetroot", state: "growth", value: 7 },
            { id: "minecraft:sweet_berry_bush", state: "growth", value: 3 },
            { id: "minecraft:nether_wart", state: "age", value: 3 },
            { id: "minecraft:cocoa", state: "age", value: 2 },
            { id: "minecraft:cactus", state: "age", value: 8 },
            { id: "minecraft:reeds", state: "age", value: 9 }, // sugar cane
            { id: "minecraft:torchflower", state: null, value: null },
            { id: "minecraft:pitcher_crop", state: "growth", value: 4 },
            // { id: "minecraft:pumpkin", state: null, value: null },
            // { id: "minecraft:melon_block", state: null, value: null },
        ],
        executeBreak: function (player, options) {
            let { blockPerm, reward } = options;
            const cropData = this.cropBlocks.find(crop => crop.id === blockPerm.type.id);
            if (!cropData)
                return;
            if (!cropData.state || cropData.value === null) {
                giveReward(player, reward);
                return;
            }
            try {
                // @ts-ignore
                const currentGrowth = blockPerm.getState(cropData.state);
                if (Number(currentGrowth) === Number(cropData.value)) {
                    giveReward(player, reward);
                }
            }
            catch (e) {
                console.warn(JSON.stringify(options));
            }
        }
    },
    {
        initialRequirement: 32,
        requirementStep: 32,
        initialReward: 0.15,
        rewardStep: 0.02,
        description: "Kill hostile mobs to earn money.",
        title: "Killing",
        type: "kill_entity",
        families: [
            "monster",
            "undead"
        ],
        execute: function (player, options) {
            let { entity, reward } = options;
            const familyData = this.families.find(family => entity.getComponent(EntityComponentTypes.TypeFamily)?.hasTypeFamily(family));
            if (!familyData)
                return;
            // console.warn("You killing ", entity.typeId);
            giveReward(player, reward);
        }
    },
    {
        initialRequirement: 64,
        requirementStep: 64,
        initialReward: 0.05,
        rewardStep: 0.01,
        maxLevel: 10,
        description: "Dig sand and dirt to earn money.",
        title: "Diging",
        type: ["break_block"],
        blocks: [
            "minecraft:sand",
            "minecraft:gravel"
        ],
        executeBreak: function (player, options) {
            let { blockPerm, reward } = options;
            const blockData = this.blocks.find(block => blockPerm.type.id === block);
            if (!blockData)
                return;
            giveReward(player, reward);
        }
    },
    {
        initialRequirement: 16,
        requirementStep: 16,
        initialReward: 1.0,
        rewardStep: 0.25,
        description: "Catch fish to earn money.",
        title: "Fishing",
        type: "fishing",
        executeFishing: function (player, options) {
            let { reward } = options;
            giveReward(player, reward);
        }
    },
    {
        initialRequirement: 64,
        requirementStep: 64,
        initialReward: 0.05,
        rewardStep: 0.01,
        description: "Cut down trees to earn money.",
        title: "Lumbering",
        type: ["break_block"],
        breakBlock: [
            "minecraft:acacia_log",
            "minecraft:birch_log",
            "minecraft:cherry_log",
            "minecraft:dark_oak_log",
            "minecraft:jungle_log",
            "minecraft:mangrove_log",
            "minecraft:oak_log",
            "minecraft:spruce_log",
            "minecraft:warped_stem",
            "minecraft:crimson_stem",
            "minecraft:pale_oak_log"
        ],
        executeBreak: function (player, options) {
            let { blockPerm, reward } = options;
            const breakBlockData = this.breakBlock.find(b => blockPerm.type.id === b);
            if (!breakBlockData)
                return;
            giveReward(player, reward);
        },
    },
    {
        initialRequirement: 64,
        requirementStep: 64,
        initialReward: 0.05,
        rewardStep: 0.01,
        description: "Mine stones and ores to earn money.",
        title: "Mining",
        type: ["break_block"],
        blocks: [
            "minecraft:coal_ore",
            "minecraft:deepslate_coal_ore",
            "minecraft:iron_ore",
            "minecraft:deepslate_iron_ore",
            "minecraft:copper_ore",
            "minecraft:deepslate_copper_ore",
            "minecraft:gold_ore",
            "minecraft:deepslate_gold_ore",
            "minecraft:redstone_ore",
            "minecraft:deepslate_redstone_ore",
            "minecraft:lapis_ore",
            "minecraft:deepslate_lapis_ore",
            "minecraft:diamond_ore",
            "minecraft:deepslate_diamond_ore",
            "minecraft:emerald_ore",
            "minecraft:deepslate_emerald_ore",
            "minecraft:nether_gold_ore",
            "minecraft:quartz_ore",
            "minecraft:ancient_debris", "minecraft:stone",
            "minecraft:granite",
            "minecraft:diorite",
            "minecraft:andesite",
            "minecraft:calcite",
            "minecraft:tuff",
            "minecraft:blackstone",
            "minecraft:deepslate"
        ],
        executeBreak: function (player, options) {
            let { blockPerm, reward } = options;
            const blockData = this.blocks.find(block => blockPerm.type.id === block);
            if (!blockData)
                return;
            giveReward(player, reward);
        }
    },
];
const fishingLoots = [
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:pufferfish",
    "minecraft:tropical_fish",
    "minecraft:bow",
    "minecraft:enchanted_book",
    "minecraft:fishing_rod",
    "minecraft:name_tag",
    "minecraft:nautilus_shell",
    "minecraft:saddle",
    "minecraft:leather_boots",
    "minecraft:stick",
    "minecraft:string",
    "minecraft:bowl",
    "minecraft:tripwire_hook",
    "minecraft:rotten_flesh",
    "minecraft:bone",
    "minecraft:ink_sac",
    "minecraft:water_bottle"
];
let lastHookLocation = null;
world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    if (entity.typeId === "minecraft:fishing_hook") {
        lastHookLocation = entity.location;
    }
    if (entity.typeId === "minecraft:item") {
        const itemStack = entity.getComponent("minecraft:item")?.itemStack;
        if (!itemStack || !fishingLoots.includes(itemStack.typeId))
            return;
        if (!lastHookLocation)
            return;
        const distance = Math.sqrt(Math.pow(entity.location.x - lastHookLocation.x, 2) +
            Math.pow(entity.location.y - lastHookLocation.y, 2) +
            Math.pow(entity.location.z - lastHookLocation.z, 2));
        if (distance <= 2) {
            const players = entity.dimension.getEntities({
                type: "minecraft:player",
                location: entity.location,
                maxDistance: 8
            });
            const fisher = players.find(player => {
                const inv = player.getComponent(EntityComponentTypes.Inventory);
                const container = inv?.container;
                const selectedSlot = player?.selectedSlotIndex;
                const heldItem = container?.getItem(selectedSlot);
                return heldItem?.typeId === "minecraft:fishing_rod";
            });
            if (fisher) {
                let player = fisher;
                let playerJob = player.getDynamicProperty("job:currentJob");
                let jobTitle = allJobs[playerJob].title;
                let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
                let job = allJobs[playerJob];
                let { initialReward, rewardStep, type, } = job;
                if (player.hasTag("job:hasEmployed") && playerJob !== undefined && typeof job.executeFishing === "function") {
                    if (type === "fishing") {
                        job.executeFishing(player, { reward: calculateNextValue(jobLevel, initialReward, rewardStep) });
                    }
                }
            }
            lastHookLocation = null;
        }
    }
});
world.afterEvents.playerSpawn.subscribe(({ player }) => {
    if (!player.hasTag("job:setup")) {
        player.addTag("job:setup");
        player.setDynamicProperty("job:money", 0);
        player.setDynamicProperty("job:currentJob");
        allJobs.forEach(job => {
            player.removeTag("job:hasEmployed");
            player.setDynamicProperty(`job:${job.title}_level`, 0);
            player.setDynamicProperty(`job:${job.title}_progress`, 0);
        });
    }
});
world.afterEvents.entityDie.subscribe(({ damageSource, deadEntity: entity }) => {
    if (damageSource.damagingEntity?.typeId !== "minecraft:player")
        return;
    let player = damageSource.damagingEntity;
    let playerJob = player.getDynamicProperty("job:currentJob");
    let playerMoney = player.getDynamicProperty("job:money");
    let jobTitle = allJobs[playerJob].title;
    let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
    let job = allJobs[playerJob];
    let { initialReward, rewardStep, type, } = job;
    if (player.hasTag("job:hasEmployed") && playerJob !== undefined && typeof job.execute === "function") {
        if (type === "kill_entity") {
            job.execute(player, { entity, reward: calculateNextValue(jobLevel, initialReward, rewardStep) });
        }
    }
});
world.afterEvents.playerBreakBlock.subscribe(({ brokenBlockPermutation: blockPerm, player }) => {
    let playerJob = player.getDynamicProperty("job:currentJob");
    if (!playerJob)
        return;
    let jobTitle = allJobs[playerJob].title;
    let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
    let job = allJobs[playerJob];
    let { initialReward, rewardStep, type, } = job;
    if (player.hasTag("job:hasEmployed") && playerJob !== undefined && typeof job.executeBreak === "function") {
        if (type?.includes("break_block")) {
            job.executeBreak(player, { blockPerm, reward: calculateNextValue(jobLevel, initialReward, rewardStep) });
        }
    }
});
// world.beforeEvents.playerPlaceBlock.subscribe(({
//     player,
//     block,
//     permutationBeingPlaced: blockPerm
// }) => {
//     let playerJob = player.getDynamicProperty("job:currentJob") as number;
//     let jobTitle = allJobs[playerJob].title;
//     let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`) as number;
//     let job = allJobs[playerJob];
//     let {
//         initialReward,
//         rewardStep,
//         type,
//     } = job;
//     if (player.hasTag("job:hasEmployed") && playerJob !== undefined && typeof job.executePlace === "function") {
//         if (type?.includes("place_block")) {
//             job.executePlace(player, {blockPerm, reward: calculateNextValue(jobLevel, initialReward, rewardStep)});
//         }
//     }
// })
world.beforeEvents.chatSend.subscribe((data) => {
    const { message, sender: player } = data;
    if (message === '!job') {
        data.cancel = true;
        if (!player.hasTag("job:open")) {
            player.sendMessage("§ePlease close the chat and wait a second...");
            system.runTimeout(() => {
                mainUI(player);
            }, 60);
        }
    }
    if (message === ';dev reset') {
        data.cancel = true;
        if (!player.isOp())
            return;
        system.run(() => {
            player.setDynamicProperty("job:money", 0);
            player.setDynamicProperty("job:currentJob");
            allJobs.forEach(job => {
                player.removeTag("job:hasEmployed");
                player.setDynamicProperty(`job:${job.title}_level`, 0);
                player.setDynamicProperty(`job:${job.title}_progress`, 0);
            });
        });
    }
});
function mainUI(player) {
    let playerJob = player.getDynamicProperty("job:currentJob");
    let form = new ActionFormData()
        .title("§f§0§1§r§l§0Job Menu");
    if (player.hasTag("job:hasEmployed") && playerJob !== undefined) {
        let jobTitle = allJobs[playerJob].title;
        form.body(`Hi ${player.nameTag}!\nYour job is §e${jobTitle}\n\n`);
        form.button("Show All Jobs");
        form.button("Job Status");
    }
    else {
        form.body("Don't have a job yet? Apply job now!");
        form.button("Show All Jobs");
    }
    form.show(player).then(res => {
        if (res.selection === 0) {
            showAllJobs(player);
        }
        if (res.selection === 1) {
            jobStatus(player);
        }
    });
}
function jobStatus(player) {
    let playerJob = player.getDynamicProperty("job:currentJob");
    let jobTitle = allJobs[playerJob].title;
    let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
    let jobProgress = player.getDynamicProperty(`job:${jobTitle}_progress`);
    let { initialRequirement, requirementStep, initialReward, rewardStep, description } = allJobs[playerJob];
    let reward = calculateNextValue(jobLevel, initialReward, rewardStep);
    let requirement = calculateNextValue(jobLevel, initialRequirement, requirementStep);
    let form = new ActionFormData()
        .title("§f§0§1§r§l§0Job Status")
        .body(`§eCurrent Job:§r §l${jobTitle}§r
§eDescription:§r ${description}\n
§eLevel:§r ${jobLevel}
§eProgress:§r ${jobProgress}/${requirement}\n
§eReward:§a $${reward}/task\n\n\n\n\n\n
    `);
    form.button("§c§lLeave Job");
    form.show(player).then(res => {
        if (res.canceled)
            mainUI(player);
        if (res.selection === 0) {
            player.sendMessage(`§cYou are no longer working as §e${jobTitle}!`);
            player.setDynamicProperty("job:currentJob");
            player.removeTag("job:hasEmployed");
            system.runTimeout(() => {
                mainUI(player);
            }, 20);
        }
    });
}
function showAllJobs(player) {
    let form = new ActionFormData()
        .title("§f§0§0§r§l§0Get a Job!")
        .button("", "textures/ui/jobs/farm")
        .button("", "textures/ui/jobs/kill")
        .button("", "textures/ui/jobs/dig")
        .button("", "textures/ui/jobs/fish")
        .button("", "textures/ui/jobs/wood")
        .button("", "textures/ui/jobs/mine");
    form.show(player).then(res => {
        if (res.canceled)
            mainUI(player);
        if (res.selection !== undefined) {
            hireUI(player, res.selection);
        }
    });
}
function hireUI(player, selection) {
    let jobTitle = allJobs[selection].title;
    let jobLevel = player.getDynamicProperty(`job:${jobTitle}_level`);
    let jobProgress = player.getDynamicProperty(`job:${jobTitle}_progress`);
    let { initialRequirement, requirementStep, initialReward, rewardStep, description } = allJobs[selection];
    let reward = calculateNextValue(jobLevel, initialReward, rewardStep);
    let requirement = calculateNextValue(jobLevel, initialRequirement, requirementStep);
    let form = new ActionFormData()
        .title(`§f§1§${selection}§r§l§0${jobTitle}`)
        .body(`§eDescription:§r ${description}\n
§eLevel:§r ${jobLevel}
§eProgress:§r ${jobProgress}/${requirement}\n
§eReward:§a $${reward}/task\n\n\n\n\n\n\n
        `);
    if (!player.hasTag("job:hasEmployed"))
        form.button("Apply Job!");
    form.show(player).then(res => {
        if (res.canceled)
            showAllJobs(player);
        else if (res.selection === 0) {
            player.sendMessage(`§aYou are applying for a job as a §e${jobTitle}!`);
            player.setDynamicProperty("job:currentJob", selection);
            player.addTag("job:hasEmployed");
            // system.runTimeout(() => {
            //     mainUI(player);
            // }, 20);
        }
    });
}
