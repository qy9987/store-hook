import { isProd } from '@/utils/is';
import loggerPlugin from './plugins/logger';
import persistPlugin from './plugins/persist';
import { Store } from './type';

const createStore = Store({
  plugins: [persistPlugin('mybugStore'), isProd ? undefined : loggerPlugin]
});

export default createStore;
