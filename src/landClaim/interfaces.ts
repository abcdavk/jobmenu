import { Vector3 } from "@minecraft/server";

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

export type Settings = {
  plotName: string,
  showBoundaries: boolean,
  anti_tnt: boolean,
  anti_creeper: boolean,
  anti_arrow: boolean,
  anti_splash_potion: boolean,
  anti_hostile: boolean
}

export interface ProtectionData {
  nameTag: string;
  location: Vector3;
  protectionSize: number;
  settings: Settings;
  allowList: AllowList[]
}

export type ExpiredDate = {
  location: Vector3,
  date: number,
  nameTag: string
}