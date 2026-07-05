import mongoose from 'mongoose';
import { findPlugins } from './plugins';

export * from './default-mongoose-options';
export * from './mongoose-queries-util';
export * from './utils';

mongoose.plugin(findPlugins);

function mongoConnect(uri: string): void {
  mongoose.connect(uri).then((e) => console.log('connectedToDB'));
}

export { mongoConnect };
