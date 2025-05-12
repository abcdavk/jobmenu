import { Block, Dimension, Player, world } from "@minecraft/server";
import { AllowList, Protection, ProtectionData } from "./landClaim";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export function handleSettingUI(player: Player, block: Block, dimension: Dimension, protectionData: ProtectionData) {
  let form = new ModalFormData()
    .title("§f§0§1§r§l§0Settings")
    .textField("Land Name:", "Land Name", { defaultValue: protectionData.settings.plotName })
    .toggle("Show Boundaries", { defaultValue: protectionData.settings.showBoundaries, tooltip: "When enable, will display particle animation around the area."});
  form.show(player).then(res => {
    if (res.formValues) {
      protectionData.settings = {
        plotName: res.formValues[0] as string,
        showBoundaries: res.formValues[1] as boolean
      }
      new Protection(player, block, dimension).set(protectionData);
    }
  });
}

export function handleAddFriendUI(player: Player, block: Block, dimension: Dimension, protectionData: ProtectionData) {
  const players = world.getPlayers();
  let playerList: string[] = ["None"]

  players.forEach(player => {
    playerList.push(player.nameTag)
  })

  let form = new ModalFormData()
    .title("Add Friend")
    .dropdown("Select Online Player:", playerList, { defaultValueIndex: 0 })
    .textField("Or type player username", "Type here", { tooltip: "Type manually if the player is not in the dropdown/offline" });
  form.show(player).then(res => {
    if (res.formValues) {
      if (res.formValues[0] !== 0 && res.formValues[1] !== "") {
        player.sendMessage("§cCan only select one, dropdown or text field!")
      } else {
        if (res.formValues[0] !== 0) {
          protectionData.allowList.push({
            nameTag: playerList[res.formValues[0] as number],
            allow_place_block: true,
            allow_break_block: true,
            allow_interact_with_block: true,
            allow_tnt: false,
            allow_button: true,
            allow_lever: true,
            allow_interact_armor_stand: true,
            allow_attack_animals: true,
            allow_attack_players: false,
          });
          new Protection(player, block, dimension).set(protectionData);
        }
        if (res.formValues[1] !== "") {
          protectionData.allowList.push({
            nameTag: res.formValues[1] as string,
            allow_place_block: true,
            allow_break_block: true,
            allow_interact_with_block: true,
            allow_tnt: false,
            allow_button: true,
            allow_lever: true,
            allow_interact_armor_stand: true,
            allow_attack_animals: true,
            allow_attack_players: false,
          });
          new Protection(player, block, dimension).set(protectionData);
        }
      }
    }
  });
}

export function handleShowAllFriendUI(player: Player, block: Block, dimension: Dimension, protectionData: ProtectionData) {
  let form = new ActionFormData()
    .title("§f§0§1§r§l§0Friend List")
    .body("List of all friends.")
  let friendList = protectionData.allowList
  // let friendCount = 0;
  for (let i = 0; i < friendList.length; i++) {
    // friendCount++
    form.button(friendList[i].nameTag);
  }
  form.show(player).then(res => {
    if (res.selection !== undefined) {
      handleFriendSettingUI(player, block, dimension, protectionData, friendList[res.selection])
    }
  })
}

function handleFriendSettingUI(player: Player, block: Block, dimension: Dimension, protectionData: ProtectionData, allowList: AllowList) {
  let {
    allow_place_block,
    allow_break_block,
    allow_interact_with_block,
    allow_tnt,
    allow_button,
    allow_lever,
    allow_interact_armor_stand,
    allow_attack_animals,
    allow_attack_players
  } = allowList
  let form = new ModalFormData()
    .title(allowList.nameTag + " Settings")
    .toggle("Allow Place Block", { defaultValue: allow_place_block })
    .toggle("Allow Break Block", { defaultValue: allow_break_block })
    .toggle("Allow Interact with Block", { defaultValue: allow_interact_with_block })
    .toggle("Allow TNT", { defaultValue: allow_tnt })
    .toggle("Allow Button", { defaultValue: allow_button })
    .toggle("Allow Lever", { defaultValue: allow_lever })
    .toggle("Allow Interact with Armor Stand", { defaultValue: allow_interact_armor_stand })
    .toggle("Allow Attack Animals", { defaultValue: allow_attack_animals })
    .toggle("Allow Attack Players", { defaultValue: allow_attack_players });
  form.show(player).then(res => {
    if (res.formValues) {
      let friendList = protectionData.allowList;
      friendList = friendList.filter(friend => {
        return !(
          friend.nameTag === allowList.nameTag
        );
      });
      friendList.push({
        nameTag: allowList.nameTag,
        allow_place_block: res.formValues[0] as boolean,
        allow_break_block: res.formValues[1] as boolean,
        allow_interact_with_block: res.formValues[2] as boolean,
        allow_tnt: res.formValues[3] as boolean,
        allow_button: res.formValues[4] as boolean,
        allow_lever: res.formValues[5] as boolean,
        allow_interact_armor_stand: res.formValues[6] as boolean,
        allow_attack_animals: res.formValues[7] as boolean,
        allow_attack_players: res.formValues[8] as boolean,
      });
      protectionData.allowList = friendList;
      new Protection(player, block, dimension).set(protectionData);
    }
  })
}