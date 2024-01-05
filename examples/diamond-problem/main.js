import {
  isCell,
  useCell,
  useComputed,
  useEffect
} from '../../tendril.js'

const [clock, sendClock] = useCell(Date.now())

const a = useComputed(() => clock() + Math.random())
const b = useComputed(() => clock() + Math.random())
const c = useComputed(() => a() + b())

console.log("message should only log once per change")

useEffect(() => {
  console.log(
    `n: ${c()}`
  )
})

setInterval(
  () => sendClock(Date.now()),
  1000
)

window.temp = {a, b, c}