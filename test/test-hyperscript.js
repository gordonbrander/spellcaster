import { describe, it } from "mocha"
import { strict as assert, strictEqual as assertEqual, fail } from "assert"
import { cid, index } from "../hyperscript.js"

describe('cid', () => {
  it('returns a string', () => {
    const id = cid()
    assert(typeof id === 'string')
  })

  it('returns a unique client ID each time it is called', () => {
    const x = cid()
    const y = cid()
    const z = cid()
    assert(x !== y)
    assert(x !== z)
    assert(y !== z)
  })
})

describe('index', () => {
  it('indexes an array of objects to map, using ID field for key by default', () => {
    const records = [
      {id: 'a', text: 'Chop wood'},
      {id: 'b', text: 'Carry water'}
    ]

    const indexedRecords = index(records)
    assert(indexedRecords instanceof Map)
    assert(indexedRecords.get('a').text, 'Chop wood')
  })

  it('indexes an array of objects to map, using key getter when provided', () => {
    const records = [
      {_key: 'a', text: 'Chop wood'},
      {_key: 'b', text: 'Carry water'}
    ]

    const indexedRecords = index(records, record => record._key)
    assert(indexedRecords.get('a').text, 'Chop wood')
  })
})