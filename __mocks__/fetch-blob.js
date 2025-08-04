// __mocks__/fetch-blob.js
class Blob {
  constructor(buffer, options) {
    this.buffer = buffer;
    this.type = options?.type || '';
  }
}
module.exports = { Blob };
