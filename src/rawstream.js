import { List } from 'immutable';
import mitt from 'mitt';
import { encode } from './encoding';
import { convertBufferToLines, bufferConcat } from './utils';

export default stream => {
  const emitter = mitt();
  let encodedLog = new Uint8Array();
  let overage = null;

  emitter.on('data', data => {
    encodedLog = bufferConcat(encodedLog, encode(data));

    const { lines, remaining } = convertBufferToLines(encode(data), overage);

    overage = remaining;

    emitter.emit('update', { lines, encodedLog });
  });

  emitter.on('done', () => {
    if (overage) {
      emitter.emit('update', { lines: List.of(overage), encodedLog });
    }

    emitter.emit('end', encodedLog);
  });

  emitter.on('start', () => {
    try {
      stream.on('data', chunk => {
        let msg = chunk.toString('utf8');

        // add a new line character between each message if one doesn't exist.
        // this allows our search index to properly distinguish new lines.
        msg = msg.endsWith('\n') ? msg : `${msg}\n`;

        emitter.emit('data', msg);
      });

      emitter.on('abort', () => stream.close());
    } catch (err) {
      emitter.emit('error', err);
    }
  });

  return emitter;
};
