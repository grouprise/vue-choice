import { mount } from 'vue-test-utils'
import SgChoice from './'

test('it works', () => {
  const wrapper = mount(SgChoice)
  expect(wrapper.isVueInstance()).toBe(true)
})
