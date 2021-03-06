import getDomPath from './getDomPath'

const getElements = (container, tag) =>
  Array.from(container.querySelectorAll(tag))

const getNodeName = (el) =>
  el.nodeName === 'A'
    ? 'a'
    : el.nodeName === 'BUTTON'
    ? 'button'
    : `${el.nodeName.toLowerCase()}[role="button"]`

export const getActiveStyles = function (container, el) {
  const sheets = container.styleSheets
  const result = []

  const activeRegex = /:active$/

  Object.keys(sheets).forEach((k) => {
    const rules = sheets[k].rules || sheets[k].cssRules
    rules.forEach((rule) => {
      if (!rule) return
      if (!rule.selectorText || !rule.selectorText.match(activeRegex)) return
      const ruleNoPseudoClass = rule.selectorText.replace(activeRegex, '')
      if (el.matches(ruleNoPseudoClass)) {
        result.push(rule)
      }
    })
  })
  return result.length ? result : null
}

export const getActiveWarnings = (container) => {
  const buttons = getElements(container, 'button').concat(
    getElements(container, '[role="button"]')
  )
  const links = getElements(container, 'a')

  return buttons
    .concat(links)
    .map((el) => [el, getActiveStyles(container, el)])
    .filter((tup) => tup[1])
    .map(([el]) => {
      return {
        type: getNodeName(el),
        text: el.innerText,
        html: el.innerHTML,
        path: getDomPath(el),
      }
    })
}

export const getTapHighlightWarnings = (container) => {
  const buttons = getElements(container, 'button').concat(
    getElements(container, '[role="button"]')
  )
  const links = getElements(container, 'a')

  const filterActiveStyles = (el) => {
    const tapHighlight = getComputedStyle(el)['-webkit-tap-highlight-color']
    if (tapHighlight === 'rgba(0, 0, 0, 0)') return true
  }

  return buttons
    .concat(links)
    .filter(filterActiveStyles)
    .map((el) => ({
      type: getNodeName(el),
      text: el.innerText,
      html: el.innerHTML,
      path: getDomPath(el),
    }))
}

const maxWidth = 500

export const getSrcsetWarnings = (container) => {
  const images = getElements(container, 'img')

  const warnings = images
    .filter((img) => {
      const src = img.getAttribute('src')
      const srcSet = img.getAttribute('srcset')
      if (srcSet) return false
      const isSVG = Boolean(src.match(/svg$/))
      if (isSVG) return false
      const isLarge =
        parseInt(getComputedStyle(img).width, 10) > maxWidth ||
        img.naturalWidth > maxWidth
      if (!isLarge) return false
      return true
    })
    .map((img) => {
      return {
        src: img.src,
        path: getDomPath(img),
        alt: img.alt,
      }
    })
  return warnings
}

const textInputs = [
  'text',
  'search',
  'tel',
  'url',
  'email',
  'number',
  'password',
]

const attachLabels = (inputs, container) => {
  return inputs.map((input) => {
    let labelText = ''
    if (input.labels && input.labels[0]) {
      labelText = input.labels[0].innerText
    } else if (input.parentElement.nodeName === 'LABEL')
      labelText = input.parentElement.innerText
    else if (input.id) {
      const label = container.querySelector(`label for="${input.id}"`)
      if (label) labelText = label.innerText
    }
    return {
      path: getDomPath(input),
      labelText,
      type: input.type,
    }
  })
}

export const getAutocompleteWarnings = (container) => {
  const inputs = getElements(container, 'input')
  const warnings = inputs.filter((input) => {
    const currentType = input.getAttribute('type')
    const autocomplete = input.getAttribute('autocomplete')
    if (textInputs.find((type) => currentType === type) && !autocomplete) {
      return true
    }
    return false
  })
  return attachLabels(warnings, container)
}

export const getInputTypeNumberWarnings = (container) => {
  const inputs = getElements(container, 'input[type="number"]')
  return attachLabels(inputs)
}

export const getOverflowAutoWarnings = (container) => {
  return getElements(container, '#root *')
    .filter((el) => {
      const style = getComputedStyle(el)
      const scrollStyles = ['scroll', 'auto']
      if (
        scrollStyles.includes(style.overflow) ||
        scrollStyles.includes(style.overflowX) ||
        scrollStyles.includes(style.overflowY)
      ) {
        if (style['-webkit-overflow-scrolling'] !== 'touch') {
          return true
        }
      }
      return false
    })
    .map((el) => ({
      path: getDomPath(el),
    }))
}

export const getOriginalStyles = function (container, el) {
  const sheets = container.styleSheets
  const result = []
  Object.keys(sheets).forEach((k) => {
    const rules = sheets[k].rules || sheets[k].cssRules
    rules.forEach((rule) => {
      if (!rule) return
      if (el.matches(rule.selectorText)) {
        result.push(rule)
      }
    })
  })
  return result.length ? result : null
}

export const get100vhWarning = (container) => {
  return getElements(container, '#root *')
    .map((el) => {
      const styles = getOriginalStyles(container, el)
      if (!styles) return false
      const hasVHWarning = styles.find((style) => /100vh/.test(style.cssText))
      if (hasVHWarning) return { el, css: hasVHWarning.cssText }
      return null
    })
    .filter(Boolean)
    .map((data) => ({
      ...data,
      path: getDomPath(data.el),
    }))
}

export const getInputTypeWarnings = (container) => {
  const inputs = getElements(container, 'input[type="text"]')
    .concat(getElements(container, 'input:not([type])'))
    .filter((input) => !input.getAttribute('inputmode'))
  return attachLabels(inputs, container)
}

const makePoints = ({ top, right, bottom, left }) => {
  return [
    [top, right],
    [top, left],
    [bottom, right],
    [bottom, left],
  ]
}

const findDistance = (point1, point2) => {
  return Math.sqrt(
    Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2)
  )
}

export const getTouchTargetSizeWarning = ({
  container,
  minSize,
  recommendedSize,
  recommendedDistance,
}) => {
  const els = getElements(container, 'button')
    .concat(getElements(container, '[role="button"]'))
    .concat(getElements(container, 'a'))
    .map((el) => [el, el.getBoundingClientRect()])

  const elsWithClose = els.map(([el1, bounding1], i1) => {
    const close = els.filter(([, bounding2], i2) => {
      if (i2 === i1) return

      const points1 = makePoints(bounding1)
      const points2 = makePoints(bounding2)

      let isTooClose = false

      points1.forEach((point1) => {
        points2.forEach((point2) => {
          const distance = findDistance(point1, point2)
          if (distance < recommendedDistance) {
            isTooClose = true
          }
        })
      })
      return isTooClose
    })
    return { close: close ? close : null, el: el1, boundingBox: bounding1 }
  })

  const underMinSize = elsWithClose.filter(
    ({ boundingBox: { width, height } }) => {
      return width < minSize || height < minSize
    }
  )

  const tooClose = elsWithClose.filter(
    ({ boundingBox: { width, height }, close }) => {
      return (
        close.length && (width < recommendedSize || height < recommendedSize)
      )
    }
  )

  const present = ({ el, boundingBox: { width, height }, close }) => {
    return {
      type:
        el.nodeName === 'A'
          ? 'a'
          : el.nodeName === 'BUTTON'
          ? 'button'
          : `${el.nodeName.toLowerCase()}[role="button"]`,
      path: getDomPath(el),
      text: el.innerText,
      html: el.innerHTML,
      width: Math.floor(width),
      height: Math.floor(height),
      close,
    }
  }

  return {
    underMinSize: underMinSize.map(present),
    tooClose: tooClose.map(present),
  }
}
