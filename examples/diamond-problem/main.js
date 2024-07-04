import {
  signal,
  computed,
  effect
} from '../../bundle/spellcaster.js'

const [clock, sendClock] = signal(Date.now())

const a = computed(() => clock() + Math.random())
const b = computed(() => clock() + Math.random())
const c = computed(() => a() + b())

console.log("message should only log once per change")

effect(() => {
  console.log(
    `n: ${c()}`
  )
})

setInterval(
  () => sendClock(Date.now()),
  1000
)
