import type { PluginInstance } from '../type';

const loggerPlugin: PluginInstance = {
  setStore(module, action) {
    console.group(`module update：%c ${module.namespace}`, 'color:#24b2f3;');
    console.group(`action update：%c ${action}`, 'color:#24b2f3;');
    console.log(`%c prev state`, 'color:#24b2f3;', module.lastState);
    console.log(`%c next state`, 'color:#24f373;', module.nextState);
    console.groupEnd();
    console.groupEnd();
  }
};

export default loggerPlugin;
