import { t } from '../i18n/index.js';
// Base map tile layers (shared by the map view and the offline tile downloader)
export const BASE_LAYERS = {
  ihm: {
    name: "מפת הטיולים של ישראל",
    url: 'https://israelhiking.osm.org.il/Hebrew/Tiles/{z}/{x}/{y}.png',
    attribution: '© <a href="https://israelhiking.osm.org.il">Israel Hiking Map</a>, © OpenStreetMap',
    maxZoom: 16
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  },
  topo: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap (CC-BY-SA), © OpenStreetMap',
    maxZoom: 17
  }
};