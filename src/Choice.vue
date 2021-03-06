<template>
  <div
    :id="componentId.wrapper"
    v-on-click-outside="dismissSelect"
    class="sg-choice"
    :class="selectClasses"
    @keydown.esc="closeFinder"
  >
    <div
      ref="current"
      class="sg-choice-current"
      tabindex="0"
      @click.prevent="toggleFinder()"
      @keydown="typeSelect"
    >
      <slot
        name="current-choice"
        :choice="currentChoice"
      >
        <component
          :is="renderer"
          v-if="currentChoice"
          :choice="currentChoice"
        />
      </slot>
      <slot name="no-result">
        <div
          v-if="!currentChoice"
          class="sg-choice-default"
        >
          {{ texts.noSelection }}
        </div>
      </slot>
      <div
        v-if="isDismissable"
        class="sg-choice-decorator sg-choice-dismiss"
        :style="decoratorStyle"
        @click.prevent.stop="dismissChoice"
      >
        <i>×</i>
      </div>
      <div
        v-else
        class="sg-choice-decorator sg-choice-caret"
        :style="decoratorStyle"
      >
        <i>▼</i>
      </div>
    </div>
    <transition
      :name="finderBelow ? 'fade-down' : 'fade-up'"
      @after-enter="updateFinderPosition"
    >
      <div
        v-show="showFinder === null ? true : showFinder"
        ref="finder"
        class="sg-choice-finder"
        :style="{ 'max-height': `${maxFinderSize}px` }"
      >
        <div
          v-if="filter && choices.length > searchThreshold"
          class="sg-choice-search"
        >
          <label
            :for="componentId.search"
            class="sr-only"
          >{{ texts.searchLabel }}</label>
          <input
            :id="componentId.search"
            ref="search"
            v-model="currentSearch"
            type="search"
            class="sg-choice-search-input"
            :placeholder="texts.searchPlaceholder"
            @keydown.down.prevent="focusChoices"
            @keydown.enter.prevent="maybeSelect"
          >
          <span class="sg-choice-search-count">{{ availableChoices.length }}</span>
        </div>

        <ol
          v-if="availableChoices.length > 0"
          ref="choices"
          class="sg-choice-choices"
          @keydown.up.prevent="prevChoice"
          @keydown.down.prevent="nextChoice"
        >
          <li
            v-for="(choice, index) in availableChoices"
            :key="index"
            :data-value="choice.value"
            tabindex="0"
            @click="select(choice)"
            @keydown.enter="select(choice)"
          >
            <slot
              name="choice"
              :choice="choice"
            >
              <component
                :is="renderer"
                :choice="choice"
                :index="index"
              />
            </slot>
          </li>
        </ol>
        <p
          v-else
          class="sg-choice-no-results"
        >
          {{ texts.noResult }}
        </p>
      </div>
    </transition>
  </div>
</template>

<script>
import onClickOutside from 'vue-on-click-outside'
import throttle from 'throttleit'

let instanceId = 0

function isFunction (obj) {
  return typeof obj === 'function'
}

function isBoolean (obj) {
  return typeof obj === 'boolean' || (
    typeof obj === 'object' && obj !== null && typeof obj.valueOf() === 'boolean'
  )
}

function isString (obj) {
  return typeof obj === 'string' || obj instanceof String
}

function find (collection, test) {
  for (const item of collection) {
    if (test(item)) {
      return item
    }
  }
}

function findIndex (collection, test) {
  let index = 0
  for (const item of collection) {
    if (test(item)) {
      return index
    }
    index++
  }
  return -1
}

function includesText (searchIn, str) {
  return isString(searchIn)
    ? searchIn.toLowerCase().indexOf(str) !== -1
    : false
}

const defaultFilter = (term, choice) => {
  return !term || (
    includesText(choice.label, term) ||
      includesText(choice.value, term) ||
      includesText(choice.text, term)
  )
}

const typeFilter = (term, choice) => {
  return choice.label.toLowerCase().indexOf(term) === 0 ||
      choice.text.toLowerCase().indexOf(term) === 0
}

export default {
  name: 'SgChoice',
  mixins: [onClickOutside.mixin],
  props: {
    id: {
      type: String,
      default: () => `sg-choice-${instanceId++}`
    },
    texts: {
      type: Object,
      default: () => ({
        searchPlaceholder: 'Suche nach Einträgen',
        searchLabel: 'Suche',
        noResult: 'Keine Ergebnisse gefunden 😔',
        noSelection: 'Keine Auswahl'
      })
    },
    renderer: {
      type: [Object, String],
      default: null
    },
    defaultValue: [String, Number],
    defaultChoice: Object,
    value: {
      type: [Number, String],
      default: null
    },
    choices: {
      type: Array,
      required: true
    },
    filter: {
      type: [Boolean, Function],
      default: () => defaultFilter
    },
    searchThreshold: {
      type: Number,
      default: 5
    }
  },
  data () {
    return {
      currentValue: null,
      showFinder: null,
      currentSearch: '',
      typedSearch: '',
      typedTimer: null,
      size: 0,
      finderSize: 0,
      maxFinderSize: null,
      resizeListener: null,
      scrollListener: null,
      finderBelow: true
    }
  },
  computed: {
    selectClasses () {
      return {
        'sg-choice-open': this.showFinder,
        'sg-choice-bottom': this.finderBelow,
        'sg-choice-top': !this.finderBelow
      }
    },
    availableChoices () {
      const term = this.currentSearch.toLowerCase()
      const filter = this.filter === false || isFunction(this.filter) ? this.filter : defaultFilter
      return isFunction(filter)
        ? this.choices.filter(choice => filter(term, choice, defaultFilter))
        : this.choices
    },
    componentId () {
      return {
        wrapper: `${this.id}-wrapper`,
        search: `${this.id}-search`
      }
    },
    currentChoice () {
      return find(this.choices, c => c.value === this.currentValue) || this.defaultChoice
    },
    currentChoiceIndex () {
      return findIndex(this.choices, c => c.value === this.currentValue)
    },
    isDismissable () {
      return this.currentChoice && this.defaultValue !== null && this.currentChoice !== this.defaultChoice
    },
    decoratorStyle () {
      return { minHeight: `calc(${this.size}px - 1rem)` }
    }
  },
  watch: {
    currentValue (value) {
      setTimeout(() => {
        this.$emit('input', value)
        this.$emit('choice', this.currentChoice)
        this.updateSize()
      }, 0)
    }
  },
  created () {
    this.currentValue = this.value || null
    this.resizeListener = throttle(this.updateSize, 250)
    this.scrollListener = throttle(this.updateFinderPosition, 250)
  },
  mounted () {
    this.updateSize()
    this.updateFinderPosition()
    window.addEventListener('resize', this.resizeListener)
    window.addEventListener('scroll', this.scrollListener)
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.resizeListener)
    window.removeEventListener('scroll', this.scrollListener)
  },
  methods: {
    toggleFinder (focus = true, forcedState = null) {
      const currentState = this.showFinder
      const newState = forcedState === null ? !this.showFinder : forcedState

      if (currentState === newState) return

      this.showFinder = newState
      this.currentSearch = ''

      if (focus && newState && this.$refs.search) {
        setTimeout(() => this.$refs.search.focus(), 0)
      } else if (focus && newState && this.$refs.choices.firstChild) {
        setTimeout(() => this.$refs.choices.firstChild.focus(), 0)
      } else if (focus && !newState && this.$refs.current) {
        setTimeout(() => this.$refs.current.focus(), 0)
      }
    },
    openFinder (focus) {
      this.toggleFinder(isBoolean(focus) ? focus : true, true)
    },
    closeFinder (focus) {
      this.toggleFinder(isBoolean(focus) ? focus : true, false)
    },
    maybeSelect () {
      if (this.availableChoices.length === 1) {
        this.currentValue = this.availableChoices[0].value
        this.closeFinder()
      }
    },
    typeSelect (event) {
      if (this.showFinder) return

      const cidx = this.currentChoiceIndex

      // reset type-search timer
      clearTimeout(this.typedTimer)
      this.typedTimer = setTimeout(() => { this.typedSearch = '' }, 500)

      /**
         * emulates basic select features like:
         * * open on enter
         * * up/down navigating choices without opening select
         */
      switch (event.keyCode) {
        case 13: // enter
          this.toggleFinder()
          return
        case 27: // escape
          this.dismissChoice()
          return
        case 38: // up
          event.preventDefault()
          if (cidx > 0) {
            this.currentValue = this.choices[cidx - 1].value
          }
          return
        case 40: // down
          event.preventDefault()
          if (cidx < this.choices.length - 1) {
            this.currentValue = this.choices[cidx + 1].value
          }
          return
      }

      /**
         * event.key is supported in modern browsers
         * and refers to the actual key being pressed
         * this code assumes that every single character
         * key value is a valid character in every language
         *
         * TODO: it would be nice to distinguish between actual
         * character classes instead of string length
         */
      if (event.key && event.key.length === 1) {
        this.typedSearch += event.key
        const term = this.typedSearch.toLowerCase()
        const choice = this.choices.filter(typeFilter.bind(null, term))[0]

        if (choice) {
          this.currentValue = choice.value
        }
      }
    },
    select (choice) {
      if (choice) {
        this.currentValue = choice.value
      }

      this.closeFinder()
    },
    focusChoices () {
      this.$refs.choices.firstChild.focus()
    },
    nextChoice (event) {
      (event.target.nextElementSibling || event.target.parentNode.firstChild).focus()
    },
    prevChoice (event) {
      (event.target.previousElementSibling || event.target.parentNode.lastChild).focus()
    },
    dismissChoice () {
      this.currentValue = this.defaultValue
    },
    dismissSelect () {
      this.closeFinder(false)
    },
    updateSize () {
      this.size = this.$refs.current.clientHeight
    },
    updateFinderPosition () {
      const { current, finder } = this.$refs

      if (!finder || !current) return

      if (finder.offsetHeight > 0) {
        this.finderSize = finder.offsetHeight
      }

      const dropdownSize = this.finderSize || 500
      const inputBounds = current.getBoundingClientRect()
      const distanceFromTop = inputBounds.top
      const distanceFromBottom = window.innerHeight - inputBounds.bottom
      // if we show the dropdown we don’t want it to sit directly
      // on the edge of the screen
      const screenEdgeOffset = 30
      const optimalDropdownSize = dropdownSize + screenEdgeOffset
      // the finder should be displayed below if we have enough space there,
      // on the top if the place below is not sufficient but on top
      // or where ever there’s more space available
      if (distanceFromBottom > optimalDropdownSize) {
        this.finderBelow = true
      } else if (distanceFromTop > optimalDropdownSize) {
        this.finderBelow = false
      } else {
        this.finderBelow = distanceFromBottom > distanceFromTop
      }
      // make sure that the finder does not overflow the screen
      this.maxFinderSize = Math.max(distanceFromBottom, distanceFromTop) - screenEdgeOffset

      // this is the initial rendering to calculate the correct finder size
      if (this.showFinder === null) {
        this.showFinder = false
      }
    }
  }
}
</script>

<style lang="less">
  .sg-choice {
    --sg-choice-accent-color: #2a62ac;
    --sg-choice-border-color: #dadada;
    --sg-choice-decorator-border-color: #bbbbbb;
    --sg-choice-decorator-color: #8b8f8d;
    --sg-choice-interaction-background: #f2f2f2;

    position: relative;
    user-select: none;

    .content-meta {
      align-items: center;
    }
  }

  .sg-choice-current {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 2px solid var(--sg-choice-border-color);
    border-radius: 2px;
    padding: .5rem 1rem;
    transition: border-color .2s;
    cursor: pointer;
    background-color: white;

    > :first-child {
      flex: 1;
    }

    .sg-choice-open &,
    &:focus {
      outline: none;
      border-color: var(--sg-choice-accent-color);
    }
  }

  .sg-choice-decorator {
    border-left: 2px solid var(--sg-choice-decorator-border-color);
    min-width: 4rem;
    color: var(--sg-choice-decorator-color);
    padding: .5rem 1rem .5rem 1.5rem;
    text-align: center;
    margin-right: -.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    i {
      transition: transform .2s, color .2s;
      display: flex;
      align-items: center;
      line-height: 1;
      font-style: normal;
      font-size: 1.75rem;
      min-height: 1.75rem;
    }
  }

  .sg-choice-dismiss:hover i,
  .sg-choice-current:hover .sg-choice-caret i {
    color: var(--sg-choice-accent-color);
  }

  .sg-choice-caret {
    i {
      transform: rotate(360deg) scaleY(.6);
      font-size: 1.25rem;
    }

    .sg-choice-open & i {
      transform: scaleY(.6) rotate(180deg);
    }

    .sg-choice-top & i {
      transform: rotate(180deg) scaleY(.6);
    }

    .sg-choice-top.sg-choice-open & i {
      transform: rotate(360deg) scaleY(.6);
    }
  }

  .sg-choice-default {
    text-transform: uppercase;
    font-size: 90%;
    font-weight: bold;
  }

  .sg-choice-finder {
    max-width: 450px;
    position: absolute;
    left: 0;
    right: 0;
    background-color: white;
    z-index: 20;
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
    overscroll-behavior: contain;
    overflow-y: auto;

    .sg-choice-bottom {
      top: 100%;
      margin-top: 1rem;
    }

    .sg-choice-top & {
      bottom: 100%;
      margin-bottom: 1rem;
    }
  }

  .sg-choice-search {
    padding: 1rem;
    background-color: var(--sg-choice-interaction-background);
    display: flex;
    align-items: center;

    .sg-choice-finder-top & {
      order: 1;
    }
  }

  .sg-choice-search-input {
    display: block;
    border: none;
    border-bottom: 2px solid var(--sg-choice-decorator-color);
    background-color: transparent;
    padding: .625rem .5rem;
    transition: border-color .2s;
    flex: 1;

    &:focus {
      outline: none;
      border-color: var(--sg-choice-accent-color);
    }
  }

  .sg-choice-search-count {
    display: flex;
    min-width: 40px;
    line-height: 1;
    justify-content: center;
    align-items: center;
    background-color: var(--sg-choice-accent-color);
    text-align: center;
    padding: .4rem .5rem;
    margin-left: 1rem;
    border-radius: 50px;
    color: white;
  }

  .sg-choice-no-results {
    margin: 1rem 0 0 0;
    padding: 0 1rem 1rem;
  }

  .sg-choice-choices {
    margin: 0;
    padding: 1rem;
    max-height: 400px;
    overflow: auto;
    overflow-x: hidden;

    > li {
      display: block;
      cursor: pointer;
      margin-bottom: .25rem;

      &:focus,
      &:hover,
      &:active {
        outline: none;
        background-color: var(--sg-choice-interaction-background);
        border-radius: 2px;
      }
    }

    .content-meta {
      padding: .5rem;
    }
  }
</style>
