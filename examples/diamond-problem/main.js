import {
  useSignal
  map,
  merge
} from '../../tendril.js'

const $clock = useSignal(new Date())

const $seconds = map($clock, date => date.getSeconds())
const $milliseconds = map($clock, date => date.getUTCMilliseconds())
const $pairs = merge($seconds, $milliseconds)

console.log("message should only log once per change")

$pairs.listen(([seconds, milliseconds]) => console.log(
  `s: ${seconds} / ms: ${milliseconds}`
))

setTimeout(
  () => $clock.send(new Date()),
  1000
)
