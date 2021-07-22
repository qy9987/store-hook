import { useUnmount } from 'ahooks';
import { getuuid } from '@/utils';
import { isProd } from '@/utils/is';
import { isEqual } from 'lodash-es';
import { useRef, useState } from 'react';

export type PluginInstance = {
  initStore?: (module: Readonly<Record<string | symbol, any>>) => void;
  setStore?: (module: Readonly<Record<string | symbol, any>>, action: string) => void;
};
interface StoreOption {
  plugins?: (PluginInstance | undefined)[];
}
interface ModuleOption<S> {
  state: S;
  namespace: string;
  persist?: boolean;
}
type ModuleInstance<M, S = Omit<M, 'namespace' | 'persist'>> = (<A = S>(
  selector?: (module: S) => A
) => A) &
  S;
// function compose(...funcs: ((...args: any) => any)[]) {
//   if (funcs.length === 0) {
//     return (arg: any) => arg;
//   }

//   if (funcs.length === 1) {
//     return funcs[0];
//   }
//   // 注册时从左往右执行，
//   return funcs.reduce(
//     (a, b) =>
//       (...args) =>
//         a(b(...args))
//   );
// }
export function Store(option: StoreOption) {
  const { plugins = [] } = option;
  const initStores: PluginInstance['initStore'][] = [];
  const setStores: PluginInstance['setStore'][] = [];
  plugins.forEach((plugin) => {
    if (!plugin) return;
    plugin.initStore && initStores.push(plugin.initStore);
    plugin.setStore && setStores.push(plugin.setStore);
  });

  return function createModule<M extends ModuleOption<any> & Record<string | symbol, any>>(
    moduleOption: M & ThisType<M & { setState: (s: Partial<M['state']>) => void }>
  ): ModuleInstance<M> {
    const storeEffectMap = new Map();
    // 初始化
    initStores.forEach((initStore) => {
      initStore && initStore(moduleOption);
    });
    const { namespace, persist, ...actions } = moduleOption as M;

    let actionName: string = '';
    // 设定store修改state的方法
    (moduleOption as any).setState = (s: any) => {
      const lastState = moduleOption.state;
      const nextState = { ...lastState, ...s };
      moduleOption.state = nextState;
      storeEffectMap.forEach((i) => {
        i(nextState);
      });
      // 生命周期
      setStores.forEach((setStore) => {
        setStore && setStore({ lastState, nextState, namespace, persist }, actionName);
      });
    };
    const keys = Object.keys(actions);
    // 重新绑定 store 方法的this，传入setState方法
    keys.forEach((i) => {
      if (typeof actions[i] === 'function' && i !== 'setState') {
        const fn = actions[i].bind(moduleOption);
        (moduleOption as any)[i] = (...args: any) => {
          actionName = i;
          fn(...args);
        };
      }
    });

    // 返回数据中移除setState
    const { setState: _s, ...result } = moduleOption;
    // useStore hook
    const useStore = (selector?: (module: Omit<M, 'namespace' | 'persist'>) => any) => {
      const uuidRef = useRef('');
      const lastValue = useRef({});
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
      if (uuidRef.current === '') {
        // 当前store使用唯一id
        uuidRef.current = getuuid();
        lastValue.current = state;
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
              if (isEqual(v, lastValue.current)) {
                return;
              }
              // 两次数据不相同，设置新的state，触发更新
              lastValue.current = v;
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
    return Object.assign(useStore, result as any);
  };
}
