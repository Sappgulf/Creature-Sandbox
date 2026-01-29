self.onmessage = (event) => {
  const data = event?.data;
  if (data?.type === 'RESET') return;

  const creatures = data?.creatures;
  if (!Array.isArray(creatures)) return;

  const pop = creatures.length;
  let herb = 0;
  let pred = 0;
  let sumSpeed = 0;
  let sumSpeed2 = 0;
  let sumMetabolism = 0;
  let sumMetabolism2 = 0;
  let sumSense = 0;
  let sumSense2 = 0;
  let sumEnergy = 0;
  let sumHealth = 0;
  let sumMaxHealth = 0;
  let sumPackInstinct = 0;
  let sumAggression = 0;
  let sumAmbushDelay = 0;

  for (const c of creatures) {
    if (c?.predator) {
      pred++;
      sumPackInstinct += c.packInstinct || 0;
      sumAggression += c.aggression || 0;
      sumAmbushDelay += c.ambushDelay || 0;
    } else {
      herb++;
    }

    sumSpeed += c.speed || 0;
    sumSpeed2 += (c.speed || 0) * (c.speed || 0);
    sumMetabolism += c.metabolism || 0;
    sumMetabolism2 += (c.metabolism || 0) * (c.metabolism || 0);
    sumSense += c.sense || 0;
    sumSense2 += (c.sense || 0) * (c.sense || 0);
    sumEnergy += c.energy || 0;
    sumHealth += c.health || 0;
    sumMaxHealth += c.maxHealth || 0;
  }

  const meanHealthRatio = sumMaxHealth ? sumHealth / sumMaxHealth : 0;
  const sample = {
    t: data?.t || 0,
    pop,
    herb,
    pred,
    food: data?.foodCount || 0,
    meanSpeed: pop ? sumSpeed / pop : 0,
    speedVar: pop ? (sumSpeed2 / pop) - Math.pow(sumSpeed / pop, 2) : 0,
    meanMetabolism: pop ? sumMetabolism / pop : 0,
    metabolismVar: pop ? (sumMetabolism2 / pop) - Math.pow(sumMetabolism / pop, 2) : 0,
    meanSense: pop ? sumSense / pop : 0,
    senseVar: pop ? (sumSense2 / pop) - Math.pow(sumSense / pop, 2) : 0,
    meanEnergy: pop ? sumEnergy / pop : 0,
    meanHealth: meanHealthRatio,
    meanMaxHealth: pop ? sumMaxHealth / pop : 0,
    meanPackInstinct: pred ? sumPackInstinct / pred : 0,
    meanAggression: pred ? sumAggression / pred : 0,
    meanAmbushDelay: pred ? sumAmbushDelay / pred : 0
  };

  self.postMessage(sample);
};
