import { useCallback, useEffect, useRef } from 'react';

const getScrollableParent = (node) => {
  let el = node && node.parentElement ? node.parentElement : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
};

const useDragAutoScroll = ({ edgeSize = 140, maxSpeed = 18, onHoverChange } = {}) => {
  const stateRef = useRef({ active: false, mouseX: 0, mouseY: 0, rafId: null });
  const hoverCallbackRef = useRef(onHoverChange);
  hoverCallbackRef.current = onHoverChange;

  const stop = useCallback(() => {
    const state = stateRef.current;
    state.active = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const frame = useCallback(() => {
    const state = stateRef.current;
    if (!state.active) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let speed = 0;
    if (state.mouseY < edgeSize) {
      speed = -((edgeSize - state.mouseY) / edgeSize) * maxSpeed;
    } else if (state.mouseY > viewportHeight - edgeSize) {
      speed = ((state.mouseY - (viewportHeight - edgeSize)) / edgeSize) * maxSpeed;
    }

    const element = document.elementFromPoint(state.mouseX, state.mouseY);
    if (element) {
      if (speed !== 0) {
        const scroller = getScrollableParent(element);
        const delta = Math.max(1, Math.round(Math.abs(speed)));
        scroller.scrollBy({ top: speed > 0 ? delta : -delta, behavior: 'auto' });
      }
      if (hoverCallbackRef.current) {
        hoverCallbackRef.current(element.closest('[data-drag-target]'));
      }
    }

    state.rafId = requestAnimationFrame(frame);
  }, [edgeSize, maxSpeed]);

  const start = useCallback((event) => {
    const state = stateRef.current;
    state.active = true;
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
    if (!state.rafId) state.rafId = requestAnimationFrame(frame);
  }, [frame]);

  const move = useCallback((event) => {
    const state = stateRef.current;
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
  }, []);

  return { startAutoScroll: start, updateAutoScroll: move, stopAutoScroll: stop };
};

export default useDragAutoScroll;
