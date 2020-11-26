/* eslint-disable no-shadow */
import set from "lodash/set";
import OptionsSync, { Options } from "webext-options-sync";
import {
  browser,
  OPTIONS_FIRST_RUN,
  UpdatedConfigMessage,
  logger,
} from "utils";

const log = logger("mbfc:utils:StorageHandler");

export enum ERporting {
  HIGH = "H",
  LOW = "L",
  MIXED = "M",
  MOSTLY_FACTUAL = "MF",
  VERY_HIGH = "VH",
  VERY_LOW = "VL",
}

export const enum EBiases {
  CENTER = "C",
  CONSPIRACY = "CP",
  FAKE_NEWS = "FN",
  LEFT = "L",
  LEFT_CENTER = "LC",
  PRO_SCIENCE = "PS",
  RIGHT = "R",
  RIGHT_CENTER = "RC",
  SATIRE = "S",
}

export const biasShortToName = {
  L: "left",
  LC: "left-center",
  C: "center",
  RC: "right-center",
  R: "right",
  PS: "pro-science",
  CP: "conspiracy",
  S: "satire",
  FN: "fake-news",
};

export const reportingShortToName = {
  H: "HIGH",
  L: "LOW",
  M: "MIXED",
  MF: "MOSTLY FACTUAL",
  VH: "VERY HIGH",
  VL: "VERY LOW",
};

export interface Collapse {
  collapseLeft: boolean;
  collapseLeftCenter: boolean;
  collapseCenter: boolean;
  collapseRightCenter: boolean;
  collapseRight: boolean;
  collapseProScience: boolean;
  collapseConspiracy: boolean;
  collapseSatire: boolean;
  collapseFakeNews: boolean;
  collapseMixed: boolean;
}

export const DefaultCollapse: Collapse = {
  collapseLeft: false,
  collapseLeftCenter: false,
  collapseCenter: false,
  collapseRightCenter: false,
  collapseRight: false,
  collapseProScience: false,
  collapseConspiracy: true,
  collapseSatire: false,
  collapseFakeNews: true,
  collapseMixed: false,
};

export interface IOptions {
  collapse: Record<ERporting, boolean>;
  hideSites: Record<string, boolean>;
  showSites: Record<string, boolean>;
}

export const OptionsToStorage = {
  collapseLeft: EBiases.LEFT,
  collapseLeftCenter: EBiases.LEFT_CENTER,
  collapseCenter: EBiases.CENTER,
  collapseRightCenter: EBiases.RIGHT_CENTER,
  collapseRight: EBiases.RIGHT_CENTER,
  collapseProScience: EBiases.PRO_SCIENCE,
  collapseConspiracy: EBiases.CONSPIRACY,
  collapseSatire: EBiases.SATIRE,
  collapseFakeNews: EBiases.FAKE_NEWS,
  collapseMixed: "M",
};

export const StorageToOptions = {
  [EBiases.LEFT]: "collapseLeft",
  [EBiases.LEFT_CENTER]: "collapseLeftCenter",
  [EBiases.CENTER]: "collapseCenter",
  [EBiases.RIGHT_CENTER]: "collapseRightCenter",
  [EBiases.RIGHT]: "collapseRight",
  [EBiases.PRO_SCIENCE]: "collapseProScience",
  [EBiases.CONSPIRACY]: "collapseConspiracy",
  [EBiases.SATIRE]: "collapseSatire",
  [EBiases.FAKE_NEWS]: "collapseFakeNews",
  M: "collapseMixed",
};

export type HiddenSites = Record<string, boolean>;
export type UnknownSites = Record<string, boolean>;

export interface IConfig {
  hiddenSites: HiddenSites;
  collapse: Collapse;
  unknown: UnknownSites;
  lastRun: number;
  firstrun: boolean;
  loaded: boolean;
  mbfcBlockAnalytics: boolean;
  pollMinutes: number;
}

const configDefaults: IConfig = {
  hiddenSites: {},
  collapse: DefaultCollapse,
  unknown: {},
  lastRun: 0,
  firstrun: true,
  loaded: false,
  mbfcBlockAnalytics: false,
  pollMinutes: 60,
};

const configToOptions = (obj: any): Options => {
  const opt: Options = {};

  const walk = (o: any, path: string[]) => {
    Object.entries(o).forEach(([n, v]) => {
      if (typeof v === "object" || v instanceof Array) {
        walk(v, [...path, n]);
      } else {
        set(opt, [...path.slice(1), n], v);
      }
    });
  };
  walk(obj, ["tree"]);
  return opt;
};

const optionsToConfig = (obj: Options): IConfig => {
  const cfg: IConfig = configDefaults;
  Object.entries(obj).forEach(([key, val]) => {
    const parts = key.split(".");
    const category = parts.shift();
    if (!category) return;
    const keys = [category];
    if (parts.length) keys.push(parts.join("."));
    set(cfg, keys, val);
  });
  return cfg;
};

export class StorageHandler {
  private static instance: StorageHandler;
  private optionsStorage: OptionsSync<Options>;

  private constructor() {
    this.optionsStorage = new OptionsSync({
      defaults: configToOptions(configDefaults),
    });
    browser.storage.onChanged.addListener(StorageHandler.onChanged);
  }

  static getInstance() {
    if (!StorageHandler.instance) {
      StorageHandler.instance = new StorageHandler();
    }
    return StorageHandler.instance;
  }

  private static async onChanged() {
    log(`Storage changed!`);
    const so = StorageHandler.getInstance();
    const opt = await so.optionsStorage.getAll();
    const config = optionsToConfig(opt);
    const msg = new UpdatedConfigMessage(config);
    msg.sendMessage(true);
  }

  public async update(cfg: IConfig) {
    await this.optionsStorage.set(configToOptions(cfg));
  }

  public async getConfig(): Promise<IConfig> {
    const opt = await this.optionsStorage.getAll();
    const config = optionsToConfig(opt);
    if (config.firstrun) {
      config.firstrun = false;
      await this.update(config);
      if (OPTIONS_FIRST_RUN) browser.runtime.openOptionsPage();
    } else {
      const msg = new UpdatedConfigMessage(config);
      msg.sendMessage(true);
    }
    return config;
  }
}
