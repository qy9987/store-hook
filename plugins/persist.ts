import { isProd } from "../utils";
import { merge, debounce } from "lodash-es";
import type { PluginInstance } from "../type";
/**
 * 获取本地存储仓库
 * @param storename 仓库名
 * @returns 数据对象
 */
function getStore(storename: string) {
  return JSON.parse(localStorage.getItem(storename) || "{}");
}
/**
 * 设置仓库存储
 * @param store 仓库存储对象
 * @param storename 仓库名
 */
function setStore(store: Record<string, any>, storename: string) {
  localStorage.setItem(storename, JSON.stringify(store));
}
/**
 * 设置module的状态数据
 * @param state module state
 * @param name module name
 * @param storename 仓库name
 */
const setModuleState = (state: any, name: string, storename: string) => {
  const lastStore = getStore(storename);
  lastStore[name] = state;
  setStore(lastStore, storename);
};
const debounceSetModuleState = debounce(setModuleState, 160);
const persistPlugin = (
  persistName: string = "persistStore"
): PluginInstance => {
  return {
    initStore(module) {
      const { persist = true, namespace, state } = module;

      if (persist) {
        const store = getStore(persistName);
        merge(state, store[namespace]);
        // 浅比较
        if (!Object.is(store[namespace], state)) {
          setModuleState(state, namespace, persistName);
        }
      }
      if (!isProd) {
        console.log(`init store module: %c ${namespace}`, "color:#24b2f3");
      }
      return [module];
    },
    setStore(module, action) {
      const { persist = true, namespace, nextState } = module;
      if (persist) {
        window.addEventListener("beforeunload", () => {
          setModuleState(nextState, namespace, persistName);
        });
        debounceSetModuleState(nextState, namespace, persistName);
      }
      return [module, action];
    },
  };
};

export default persistPlugin;
