// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });

let clients = new Map(); // id -> {lat, lng}
let tripwires = [];      // shared tripwires

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  let dLat = toRad(lat2 - lat1);
  let dLon = toRad(lon2 - lon1);

  let a = Math.sin(dLat/2) ** 2 +
          Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon/2) ** 2;

  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

wss.on("connection", ws => {
  const id = Math.random().toString(36).substr(2, 9);
  clients.set(id, { lat: 0, lng: 0 });

  ws.send(JSON.stringify({ type: "init", id, tripwires }));

  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // LOCATION UPDATE
    if (data.type === "location") {
      clients.set(id, { lat: data.lat, lng: data.lng });

      // CHECK TRIPWIRES
      tripwires.forEach(t => {
        const d = getDistance(data.lat, data.lng, t.lat, t.lng);

        if (d <= t.radius) {
          broadcast({
            type: "trigger",
            name: t.name,
            user: id
          });
        }
      });
    }

    // CREATE TRIPWIRE
    if (data.type === "tripwire") {
      tripwires.push({
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        radius: data.radius
      });

      broadcast({ type: "tripwire_list", tripwires });
    }
  });

  ws.on("close", () => {
    clients.delete(id);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

console.log("Server running on ws://localhost:3000");