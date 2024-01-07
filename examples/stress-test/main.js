import {
  signal,
  computed,
  effect
} from '../../tendril.js'

const [a, setA] = signal(0)
const [b, setB] = signal(0)
const [c, setC] = signal(0)

let computeds = []
for (var i = 0; i < 10000; i++) {
  const x = computed(() => a() + b() + c())
  computeds.push(x)
}

let combined = computed(() => {
  let x = 0
  for (let c of computeds) {
    x = x + c()
  }
  return x
})

effect(() => {
  console.time()
  combined()
  console.timeEnd()
})

setA(Date.now())
setB(Date.now())
setC(Date.now())