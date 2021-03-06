describe('mdSidenav', function() {
  beforeEach(module('material.components.sidenav', 'ngAnimateMock', function($provide) {
    $provide.value('$$rAF', function(cb) { cb(); });
  }));

  function setup(attrs) {
    var el;
    inject(function($compile, $rootScope) {
      var parent = angular.element('<div>');
      el = angular.element('<md-sidenav ' + (attrs||'') + '>');
      parent.append(el);
      $compile(parent)($rootScope);
      $rootScope.$apply();
    });
    return el;
  }

  describe('directive', function() {

    it('should bind isOpen attribute', inject(function($rootScope, $animate) {
      var el = setup('md-is-open="show"');
      $rootScope.$apply('show = true');

      $animate.triggerCallbacks();
      expect(el.hasClass('md-closed')).toBe(false);
      expect(el.parent().find('md-backdrop').length).toBe(1);

      $rootScope.$apply('show = false');
      $animate.triggerCallbacks();
      expect(el.hasClass('md-closed')).toBe(true);
      expect(el.parent().find('md-backdrop').length).toBe(0);
    }));

    it('should close on escape', inject(function($rootScope, $animate, $mdConstant, $timeout) {
      var el = setup('md-is-open="show"');
      $rootScope.$apply('show = true');

      $animate.triggerCallbacks();
      el.parent().triggerHandler({
        type: 'keydown',
        keyCode: $mdConstant.KEY_CODE.ESCAPE
      });
      $timeout.flush();
      expect($rootScope.show).toBe(false);
    }));

    it('should close on backdrop click', inject(function($rootScope, $animate, $timeout) {
      var el = setup('md-is-open="show"');
      $rootScope.$apply('show = true');

      $animate.triggerCallbacks();
      el.parent().find('md-backdrop').triggerHandler('click');
      $timeout.flush();
      expect($rootScope.show).toBe(false);
    }));

    it('should focus sidenav on open', inject(function($rootScope, $animate, $document) {
      TestUtil.mockElementFocus(this);
      var el = setup('md-is-open="show"');
      $rootScope.$apply('show = true');

      $animate.triggerCallbacks();
      expect($document.activeElement).toBe(el[0]);
    }));

    it('should lock open when is-locked-open is true', inject(function($rootScope, $animate, $document) {
      var el = setup('md-is-open="show" md-is-locked-open="lock"');
      expect(el.hasClass('md-locked-open')).toBe(false);
      $rootScope.$apply('lock = true');
      expect(el.hasClass('md-locked-open')).toBe(true);
      $rootScope.$apply('show = true');
      $animate.triggerCallbacks();
      expect(el.parent().find('md-backdrop').hasClass('md-locked-open')).toBe(true);
    }));

    it('should expose $mdMedia service as $media local in is-locked-open attribute', function() {
      var mdMediaSpy = jasmine.createSpy('$mdMedia');
      module(function($provide) {
        $provide.value('$mdMedia', mdMediaSpy);
      });
      inject(function($rootScope, $animate, $document, $mdMedia) {
        var el = setup('md-is-locked-open="$media(123)"');
        expect($mdMedia).toHaveBeenCalledWith(123);
      });
    });

  });

  describe('controller', function() {
    it('should create controller', function() {
      var el = setup('');
      var controller = el.controller('mdSidenav');
      expect(controller).not.toBe(undefined);
    });

    it('should open and close and toggle', inject(function($timeout) {
      var el = setup('');
      var scope = el.isolateScope();
      var controller = el.controller('mdSidenav');

      // Should start closed
      expect(el.hasClass('md-closed')).toBe(true);

      controller.open();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(false);

      controller.close();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(true);

      controller.toggle();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(false);
    }));

  });

  describe("controller Promise API", function() {
    var $animate, $rootScope;

      function flush() {
        if ( !$rootScope.$$phase) {
          $rootScope.$apply();
        }
        $animate.triggerCallbacks();
      }

    beforeEach( inject(function(_$animate_,_$rootScope_,_$timeout_) {
        $animate = _$animate_;
        $rootScope = _$rootScope_;
        $timeout = _$timeout_;
    }));


    it('should open(), close(), and toggle() with promises', function () {
      var el = setup('');
      var scope = el.isolateScope();
      var controller = el.controller('mdSidenav');

      var openDone = 0, closeDone = 0, toggleDone = 0;
      var onOpen = function() { openDone++; };
      var onClose = function() { closeDone++; };
      var onToggle = function() { toggleDone++; };

      controller
        .open()
        .then(onOpen)
        .then(controller.close)
        .then(onClose);

      flush();
      expect(openDone).toBe(1);
      flush();
      expect(closeDone).toBe(1);

      controller
        .close()
        .then(onClose);

      flush();
      expect(closeDone).toBe(2);
      expect(scope.isOpen).toBe(false);

      controller
        .toggle()
        .then(onToggle);

      flush();
      expect(toggleDone).toBe(1);
      expect(scope.isOpen).toBe(true);
    });


    it('should open() to work multiple times before close()', function () {
      var el = setup('');
      var controller = el.controller('mdSidenav');

      var openDone = 0, closeDone = 0;
      var onOpen = function() { openDone++; };
      var onClose = function() { closeDone++; };

      controller
        .open()
        .then(onOpen)
        .then(controller.open)
        .then(onOpen);

      flush();
      expect(openDone).toBe(2);
      expect(closeDone).toBe(0);
      expect(el.hasClass('md-closed')).toBe(false);

      controller
        .close()
        .then(onClose);

      flush();
      expect(openDone).toBe(2);
      expect(closeDone).toBe(1);
      expect(el.hasClass('md-closed')).toBe(true);
    });

  });

  describe('$mdSidenav Service', function() {
    it('should grab instance', inject(function($mdSidenav) {
      var el = setup('md-component-id="left"');
      var scope = el.isolateScope();

      var instance = $mdSidenav('left');
      expect(instance).toBeTruthy();

      instance.open();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(false);

      instance.close();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(true);

      instance.toggle();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(false);

      instance.toggle();
      scope.$apply();

      expect(el.hasClass('md-closed')).toBe(true);
    }));

    it('exposes state', inject(function($mdSidenav) {
      var el = setup('md-component-id="stateTest" md-is-open="shouldOpen" md-is-locked-open="shouldLockOpen"');
      var scope = el.scope();

      var instance = $mdSidenav('stateTest');
      expect(instance.isOpen()).toBe(false);
      expect(instance.isLockedOpen()).toBe(false);

      scope.shouldOpen = true;
      scope.shouldLockOpen = true;
      scope.$digest();
      expect(instance.isOpen()).toBe(true);
      expect(instance.isLockedOpen()).toBe(true);
    }));
  });

});
