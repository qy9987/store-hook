import { useUnmount } from "ahooks";
import { isProd, getuuid } from "./utils";
import { isEqual } from "lodash-es";
import { useRef, useState } from "react";

interface ModuleOption<S> {
  state: S;
  namespace: string;
  persist?: boolean;
}
export type PluginInstance = {
  initStore?: (module: Readonly<ModuleOption<any>>) => void;
  setStore?: (
    module: Readonly<{
      nextState: any;
      lastState: any;
      namespace: string;
      persist: boolean;
    }>,
    action: string
  ) => void;
};
interface StoreOption {
  plugins?: (PluginInstance | undefined)[];
}
type ModuleInstance<M, S = Omit<M, "namespace" | "persist">> = (<A = S>(
  selector?: (module: S) => A
) => A) &
  S;
function compose(...funcs: ((...args: any) => any)[]) {
  if (funcs.length === 0) {
    return (arg: any) => arg;
  }

  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => b(...a(...args)));
}
export function Store(option: StoreOption) {
  const { plugins = [] } = option;
  const initStores: NonNullable<PluginInstance["initStore"]>[] = [];
  const setStores: NonNullable<PluginInstance["setStore"]>[] = [];
  plugins.forEach((plugin) => {
    if (!plugin) return;
    plugin.initStore && initStores.push(plugin.initStore);
    plugin.setStore && setStores.push(plugin.setStore);
  });

  return function createModule<
    M extends ModuleOption<any> & Record<string | symbol, any>
  >(
    moduleOption: M &
      ThisType<M & { setState: (s: Partial<M["state"]>) => void }>
  ): ModuleInstance<M> {
    const storeEffectMap = new Map();
    // 初始化
    compose(...initStores)(moduleOption);
    const { namespace, persist, ...actions } = moduleOption as M;

    let actionName: string = "";
    // 设定store修改state的方法
    (moduleOption as any).setState = (s: any) => {
      const lastState = { ...moduleOption.state };
      const nextState = Object.assign(moduleOption.state, s);
      storeEffectMap.forEach((i) => {
        i(nextState);
      });
      // 生命周期
      compose(...setStores)(
        { lastState, nextState, namespace, persist },
        actionName
      );
    };
    const keys = Object.keys(actions);
    keys.forEach((i) => {
      if (typeof actions[i] === "function" && i !== "setState") {
        (actions as any)[i] = (...args: any) => {
          actionName = i;
          moduleOption[i](...args);
          // actions[i].call(moduleOption, ...args);
        };
      }
    });

    // useStore hook
    const useStore = (
      selector?: (module: Omit<M, "namespace" | "persist">) => any
    ) => {
      const uuidRef = useRef("");
      const originState = moduleOption.state;
      // 创建store使用的state
      const initState = { ...actions, state: { ...originState } };
      const [state, setState] = useState(() => {
        return selector ? selector(initState) : initState;
      });
      // 卸载时删除监听函数
      useUnmount(() => {
        storeEffectMap.delete(uuidRef.current);
      });
      // uuid为空，代表还未进行初始化
      if (uuidRef.current === "") {
        // 当前store使用唯一id
        uuidRef.current = getuuid();
        // 设置数据订阅
        storeEffectMap.set(uuidRef.current, (obj: any) => {
          // 存在selector筛选
          const nextState = { ...actions, state: { ...obj } };
          if (selector) {
            // 使用trycatch规避多层获取数据不存在的错误
            try {
              // 筛选数据
              const v = selector(nextState);
              // 当前数据与上次数据比较，相等直接跳出，不修改state
              if (isEqual(v, state)) {
                return;
              }
              // 两次数据不相同，设置新的state，触发更新
              setState(v);
            } catch (error) {
              isProd || console.log(error);
            }
          } else {
            // 不存在selector筛选时，value的任何更改都会触发state更新
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            setState(nextState);
          }
        });
      }
      return state;
    };
    return Object.assign(useStore, actions as any);
  };
}
