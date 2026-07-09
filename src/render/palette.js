// Single source of color. 28-color fixed palette. Referenced by name everywhere.

export const PAL = {
  // base / ui
  bg0: '#161320', bg1: '#241b2f', ink: '#0f0a17',
  white: '#f4f1e6', cream: '#e6dcc0', shadow: 'rgba(15,10,23,0.32)',
  // floor
  floorA: '#4a4360', floorB: '#544c6c', wall: '#2c2740', wallLip: '#6a6088',
  // furniture
  tableTop: '#8a5a3c', tableLeg: '#5c3a26', tableDirty: '#6b7a3a',
  stove: '#3a3d4a', stoveHot: '#ff8a3c', steel: '#7f8697', flame: '#ffd24a',
  // characters (skin/body variety handled by tint)
  skin: '#e6b48c', chef: '#e8e4d8', waiter: '#4aa3d6', apron: '#d64a6a',
  // feedback
  coin: '#ffd24a', coinEdge: '#c98a1e', good: '#6bd66b', bad: '#e0503a',
  heart: '#ff6b8a', star: '#ffe066',
  // food tints
  food1: '#e8c14a', food2: '#c9743a', food3: '#e0a85a',
  food4: '#e8607a', food5: '#a5432e', food6: '#c86bd6',
};

// Simple body-color variety for customers (deterministic by id).
export const BODY_TINTS = ['#d67a4a', '#5ca35c', '#c9524a', '#7a6bd6', '#3f9ab0', '#c9a03a', '#b05ca3', '#4a7ad6'];
