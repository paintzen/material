(function() {
'use strict';

/**
 * Initialization function that validates environment
 * requirements.
 */
angular.module('material.core', ['material.core.theming'])
  .run(MdCoreInitialize)
  .config(MdCoreConfigure);

function MdCoreInitialize() {
}

function MdCoreConfigure($provide, $mdThemingProvider) {
  $provide.decorator('$$rAF', rAFDecorator);

  $mdThemingProvider.theme('default')
    .primaryColor('blue')
    .accentColor('green')
    .warnColor('red')
    .backgroundColor('grey');
}

function rAFDecorator($delegate, $rootScope) {
  /**
   * Use this to throttle events that come in often.
   * The throttled function will always use the *last* invocation before the
   * coming frame.
   *
   * For example, window resize events that fire many times a second:
   * If we set to use an raf-throttled callback on window resize, then
   * our callback will only be fired once per frame, with the last resize
   * event that happened before that frame.
   *
   * @param {function} callback function to debounce
   */
  $delegate.throttle = function(cb) {
    var queueArgs, alreadyQueued, queueCb, context;
    return function debounced() {
      queueArgs = arguments;
      context = this;
      queueCb = cb;
      if (!alreadyQueued) {
        alreadyQueued = true;
        $delegate(function() {
          queueCb.apply(context, queueArgs);
          alreadyQueued = false;
        });
      }
    };
  };
  return $delegate;
}

})();
