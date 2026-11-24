// Thin wrapper over the Java backend. The frontend never plans: it only sends input and draws results.
async function request(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Request failed (' + res.status + ')')
    err.status = res.status
    err.details = data && data.details
    throw err
  }
  return data
}

export const api = {
  createPlan: (day, bufferPercentile, recovery) => request('POST', '/plan', { day, bufferPercentile, recovery }),
  getPlan: (id) => request('GET', '/plan/' + id),
  storyArrival: (day) => request('GET', '/story/arrival?day=' + day),
  occupancy: (id) => request('GET', '/plan/' + id + '/occupancy'),
  busiest: (id, window) => request('GET', '/plan/' + id + '/busiest?window=' + window),
  delay: (id, flight, minutes, atMinute) => request('POST', '/plan/' + id + '/delay', { flight, minutes, atMinute }),
  cancel: (id, flight, atMinute) => request('POST', '/plan/' + id + '/cancel', { flight, atMinute }),
  realTimes: (id) => request('POST', '/plan/' + id + '/real-times'),
  why: (id, flight) => request('GET', '/plan/' + id + '/why/' + encodeURIComponent(flight)),
  race: (id) => request('POST', '/plan/' + id + '/race'),
  search: (day, q) => request('GET', '/flights/search?day=' + day + '&q=' + encodeURIComponent(q)),
  storm: (id, severityPercentile, seed, from, to) => request('POST', '/plan/' + id + '/storm', { severityPercentile, seed, from, to }),
  groundDelay: (id, from, to, minutes) => request('POST', '/plan/' + id + '/ground-delay', { from, to, minutes }),
  replan: (id, from, hold = true) => request('POST', '/plan/' + id + '/replan', { from: Math.floor(from), hold }),
  swap: (id, flight, size) => request('POST', '/plan/' + id + '/swap', { flight, size }),
  rush: (id, count, seed, atMinute) => request('POST', '/plan/' + id + '/rush', { count, seed, atMinute }),
  radar: (id, minute) => request('GET', '/plan/' + id + '/radar?minute=' + Math.floor(minute)),
  board: (id, minute, type, count) => request('GET', '/plan/' + id + '/board?minute=' + Math.floor(minute) + '&type=' + type + '&count=' + count),
  notice: (id, text, mode) => request('POST', '/plan/' + id + '/notices', { text, mode }),
  withdrawNotice: (id, noticeId) => request('DELETE', '/plan/' + id + '/notices/' + noticeId),
  searchNotices: (id, q) => request('GET', '/plan/' + id + '/notices/search?q=' + encodeURIComponent(q)),
  delayStats: (percentile, seed) => request('GET', '/stats/delays?percentile=' + percentile + '&seed=' + seed),
  snapshot: (structure, plan, stand) => request('GET', '/snapshots/' + structure + '?plan=' + plan + (stand ? '&stand=' + stand : '')),
  bench: (suite, sizes, seed) => request('POST', '/bench/run', { suite, sizes, seed }),
  exact: (flights, seed) => request('POST', '/exact', { flights, seed })
}
