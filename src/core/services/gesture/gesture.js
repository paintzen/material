(function() {
'use strict';

/*
 * TODO: Add support for multiple fingers on the `pointer` object (enables pinch gesture)
 */

var START_EVENTS = 'mousedown touchstart pointerdown';
var MOVE_EVENTS = 'mousemove touchmove pointermove';
var END_EVENTS = 'mouseup mouseleave touchend touchcancel pointerup pointercancel';
var HANDLERS;

document.addEventListener('click', function(ev) {
  // Prevent clicks unless they're sent by material
  if (!ev.$material) {
    ev.preventDefault();
    ev.stopPropagation();
  }
}, true);

angular.element(document)
  .on(START_EVENTS, gestureStart)
  .on(MOVE_EVENTS, gestureMove)
  .on(END_EVENTS, gestureEnd)
  // For testing
  .on('$$mdGestureReset', function() {
    lastPointer = pointer = null;
  });

// The state of the current and previous 'pointer' (user's hand)
var pointer, lastPointer;

function runCallbacks(callbackType, event) {
  var handler;
  for (var handlerName in HANDLERS) {
    handler = HANDLERS[handlerName];
    if (callbackType === 'onStart') {
      handler.reset();
    }
    handler[callbackType](event, pointer);
  }
}

function gestureStart(ev) {
  // If we're already touched down, abort
  if (pointer) return;

  var now = +Date.now();
  // iOS & old android bug: after a touch event, a click event is sent 350 ms later.
  // If <400ms have passed, don't allow an event of a different type than the previous event
  if (lastPointer && !typesMatch(ev, lastPointer) && (now - lastPointer.endTime < 400)) {
    return;
  }

  pointer = makeStartPointer(ev);

  runCallbacks('onStart', ev);
}

function gestureMove(ev) {
  if (!pointer || !typesMatch(ev, pointer)) return;

  updatePointerState(ev, pointer);
  runCallbacks('onMove', ev);
}

function gestureEnd(ev) {
  if (!pointer || !typesMatch(ev, pointer)) return;

  updatePointerState(ev, pointer);
  pointer.endTime = +Date.now();

  runCallbacks('onEnd', ev);

  lastPointer = pointer;
  pointer = null;
}

/******** Helpers *********/
function typesMatch(ev, pointer) {
  return ev && pointer && ev.type.charAt(0) === pointer.type;
}

function getEventPoint(ev) {
  ev = ev.originalEvent || ev; // support jQuery events
  return (ev.touches && ev.touches[0]) ||
    (ev.changedTouches && ev.changedTouches[0]) ||
    ev;
}

function updatePointerState(ev, pointer) {
  var point = getEventPoint(ev);
  var x = pointer.x = point.pageX;
  var y = pointer.y = point.pageY;

  pointer.distanceX = x - pointer.startX;
  pointer.distanceY = y - pointer.startY;
  pointer.distance = Math.sqrt(
    pointer.distanceX * pointer.distanceX + pointer.distanceY * pointer.distanceY
  );

  pointer.directionX = pointer.distanceX > 0 ? 'right' : pointer.distanceX < 0 ? 'left' : '';
  pointer.directionY = pointer.distanceY > 0 ? 'up' : pointer.distanceY < 0 ? 'down' : '';

  pointer.duration = +Date.now() - pointer.startTime;
  pointer.velocityX = pointer.distanceX / pointer.duration;
  pointer.velocityY = pointer.distanceY / pointer.duration;
}


function makeStartPointer(ev) {
  var point = getEventPoint(ev);
  var startPointer = {
    startTime: +Date.now(),
    target: ev.target,
    // 'p' for pointer, 'm' for mouse, 't' for touch
    type: ev.type.charAt(0)
  };
  startPointer.startX = startPointer.x = point.pageX;
  startPointer.startY = startPointer.y = point.pageY;
  return startPointer;
}

angular.module('material.core')
.run(function($mdGesture) {}) //make sure mdGesture runs always
.provider('$mdGesture', function() {
  HANDLERS = {};
  var provider;

  // Use the same eventOptions for every event dispatch to avoid extra memory allocation
  var eventOptions = {
    cancelable: true,
    bubbles: true
  };
  /*
   * NOTE: dispatchEvent can be called every touchmove event, and as a result is 
   * very performance sensitive.
   */
  function dispatchEvent(srcEvent, type, customPointer) {
    var customEvent = new CustomEvent(type, eventOptions);
    customEvent.$material = true;
    customEvent.pointer = customPointer || pointer;
    customEvent.srcEvent = srcEvent;

    pointer.target.dispatchEvent(customEvent);
  }

  addHandler('click', function() {
    return {
      options: {
        maxDistance: 6,
      },
      onEnd: function(ev, pointer) {
        if (pointer.distance < this.options.maxDistance) {
          var mouseEvent = new MouseEvent('click', {
            clientX: pointer.x,
            clientY: pointer.y,
            screenX: pointer.x,
            screenY: pointer.y,
            bubbles: true,
            cancelable: true,
            view: window
          });
          mouseEvent.srcEvent = ev;
          mouseEvent.$material = true;
          mouseEvent.pointer = pointer;
          pointer.target.dispatchEvent(mouseEvent);
        }
      }
    };
  });

  addHandler('press', function() {
    return {
      onStart: function(ev, pointer) {
        dispatchEvent(ev, '$md.pressdown');
      },
      onEnd: function(ev, pointer) {
        dispatchEvent(ev, '$md.pressup');
      }
    };
  });

  // addHandler('hold', function($timeout) {
  //   var self;
  //   var holdPos;
  //   var holdTimeout;
  //   var holdTriggered;
  //   return self = {
  //     reset: function() {
  //       $timeout.cancel(holdTimeout);
  //       holdPos = holdTimeout = holdTriggered = null;
  //     },
  //     options: {
  //       delay: 500,
  //       maxDistance: 6,
  //     },
  //     onStart: resetTimeout,
  //     onMove: function(ev, pointer) {
  //       var dx = holdPos.x - pointer.x;
  //       var dy = holdPos.y - pointer.y;
  //       if (pointer.distance > self.options.maxDistance) {
  //         resetTimeout(ev, pointer);
  //       }
  //     },
  //     onEnd: function(ev, pointer) {
  //       self.reset();
  //     }
  //   };
  //   function resetTimeout(ev, pointer) {
  //     if (holdTimeout) {
  //       $timeout.cancel(holdTimeout);
  //       holdTimeout = null;
  //     }
  //     if (!holdTriggered) {
  //       holdPos = {x: pointer.x, y: pointer.y};
  //       holdTimeout = $timeout(function() {
  //         element.triggerHandler('$md.hold', pointer);
  //         holdTriggered = true;
  //       }, self.options.delay);
  //     }
  //   }
  // });

  addHandler('drag', /* @ngInject */ function($$rAF) {
    var dragState;
    var dragCancelled;
    var dispatchDragMove = $$rAF.throttle(function(ev) {
      if (dragState) {
        updatePointerState(ev, dragState);
        dispatchEvent(ev, '$md.drag', dragState);
      }
    });

    return {
      reset: function() {
        dragState = dragCancelled = null;
      },
      options: {
        minDistance: 6,
      },
      shouldPreventMove: function(ev, pointer) {
        var farEnoughY = Math.abs(pointer.distanceY) > this.options.minDistance;
        if (!dragState) {
          if (farEnoughY) {
            dragCancelled = true;
            return false;
          }
          return true;
        } else {
          return true;
        }
      },
      onMove: function(ev, pointer) {
        if (dragCancelled) return;
        if (!dragState) {
          if (Math.abs(pointer.distanceX) > this.options.minDistance) {
            // Create a new pointer, starting at this point where the drag started.
            dragState = makeStartPointer(ev);
            updatePointerState(ev, dragState);
            dispatchEvent(ev, '$md.dragstart', dragState);
          }
        } else {
          dispatchDragMove(ev);
        }
      },
      onEnd: function(ev, pointer) {
        if (dragCancelled) return;
        if (dragState) {
          updatePointerState(ev, dragState);
          dispatchEvent(ev, '$md.dragend', dragState);
          dragState = null;
        }
      }
    };
  });

  addHandler('swipe', function() {
    return {
      options: {
        minVelocity: 0.65,
        minDistance: 10,
      },
      onEnd: function(ev, pointer) {
        if (Math.abs(pointer.velocityX) > this.options.minVelocity &&
            Math.abs(pointer.distanceX) > this.options.minDistance) {
          var eventType = pointer.directionX == 'left' ? '$md.swipeleft' : '$md.swiperight';
          dispatchEvent(ev, eventType);
        }
      }
    };
  });

  return provider = {
    addHandler: addHandler,
    $get: GestureFactory
  };

  function addHandler(name, factory) {
    HANDLERS[name] = factory;
    return provider;
  }

  /* @ngInject */
  function GestureFactory($mdUtil, $rootScope, $document, $rootElement, $injector) {
    angular.forEach(HANDLERS, function(handler, handlerName) {
      HANDLERS[handlerName] = angular.extend({
        name: handlerName,
        reset: angular.noop,
        onStart: angular.noop,
        onMove: angular.noop,
        onEnd: angular.noop,
        shouldPreventMove: angular.noop,
        options: {}
      }, $injector.invoke( HANDLERS[handlerName] ));
    });

    return {
      // Register just does one thing:
      // If any of the handlers given have an onMove function defined, 
      // then preventDefault() on touchmove events.
      register: function(element, handlers) {
        var onMoveHandlers = (handlers || '')
          .split(' ')
          .map(function(handlerName) {
            return HANDLERS[ handlerName.replace(/^\$md./, '') ];
          })
          .filter(function(handler) {
            return handler && handler.onMove !== angular.noop;
          });

        if (onMoveHandlers.length) {
          element.on('touchmove', function preventDefaultListener(ev) {
            var shouldPrevent = onMoveHandlers.some(function(handler) {
              return handler.shouldPreventMove(ev, pointer);
            });
        console.log('shouldPreventMove', shouldPrevent);
            if (shouldPrevent) ev.preventDefault();
          });
          return function deregister() {
            element.off('touchmove', preventDefaultListener);
          };
        }
        return angular.noop;
      }
    };

  }

  function preventDefaultListener(ev) {
    ev.preventDefault();
  }

});

})();
