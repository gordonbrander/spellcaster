import {
  useSignal,
  map,
  sample
} from '../../tendril.js'

let [clock, setClock] = useSignal(new Date())

let seconds = map(clock, date => date.getSeconds())
let milliseconds = map(clock, date => date.getUTCMilliseconds())

let message = sample(
  [seconds, milliseconds],
  () => `s: ${seconds()} / ms: ${milliseconds()}`
)

console.log("message should only log once per clock change")
message.observe(value => console.log(value))

setInterval(
  () => {
    setClock(new Date())
  },
  1000
)