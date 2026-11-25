import { createServer } from 'node:http';
import { handleAi } from './ai-proxy';
import { attachWs } from './ws';

const port = Number(process.env.PORT ?? 8787);

const server = createServer((req, res) => {
  if (!handleAi(req, res)) {
    res.writeHead(404).end();
  }
});

attachWs(server);

server.listen(port, () => {
  console.log(`asset-forge server listening on :${port}`);
});
