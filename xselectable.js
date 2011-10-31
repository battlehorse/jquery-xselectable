/*
  Copyright (c) 2011 Riccardo Govoni

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
 * A jQuery plugin that mimics jQuery UI 'selectable' (see
 * http://jqueryui.com/demos/selectable/) while adding significant extras:
 *
 * - Selection works over Flash embeds. Flash embeds would normally swallow
 *   click events, causing the selection gesture not to terminate if the mouse
 *   were to be released within the Flash embed. This plugin separates the
 *   selection box from the selectable elements via glass panels to fix that.
 *
 * - Scrolling support. When the selectable container is scrollable and the
 *   selection box is dragged toward its border, the container is scrolled
 *   accordingly to let the selection gesture continue until the container
 *   scrollable limits are hit.
 *   Scrolling management is pluggable, which allows for different scrolling
 *   implementations (in addition to the default one which relies on native
 *   browser scrolling functionality). For example, a Google Maps-like endless
 *   scrolling can be easily implemented.
 *
 * - Selection does not inadvertently trigger when the mouse down event
 *   occurs over scrollbars. See http://bugs.jqueryui.com/ticket/4441.
 *
 * - The plugin doesn't require any of jQuery UI machinery, but can be used
 *   directly on top of jQuery, possibly reducing the javascript payload used in
 *   the hosting page.
 *
 * The plugin semantics are similar to jQuery UI 'selectable' ones but not the
 * same. While it's fairly straightforward to replace jQuery UI plugin for
 * this, this pluging is not 100% compatible drop-in replacement due to a number
 * of differences:
 *
 * - The plugin deals only with box-selection. Single element selection by
 *   clicking on a selectable element must be implemented externally.
 *
 * - Multiple non-adjacent selections are not supported.
 *
 * - Not all of jQuery UI 'selectable' options are supported -- e.g. 'delay',
 *   'tolerance:fit' and refresh management.
 *
 * - Only event-based notification of plugin actions (selection start and stop,
 *   change in selected elements) is supported. Callback-based notification is
 *   not supported.
 *
 * - Only one 'selected' and 'unselected' event pair is fired at the end of the
 *   selection gesture, pointing to an array of all selected, unselected
 *   elements (contrary to jQuery UI plugin firing a separate event for each
 *   selected, unselected item).
 *
 * - Manual refresh management is delegated to external functionality (if the
 *   delevoper wants to adopt it) for better granularity: the developer becomes
 *   responsible for tracking the positions of all selectable elements (contrary
 *   to the jQuery UI plugin which only allows the developer to trigger a manual
 *   refresh, that will recompute all selectable elements' positions in bulk).
 *
 * - Different class prefixes are used for selectable statuses.
 *
 * Refer to http://github.com/battlehorse/jquery-xselectable for further info,
 * documentation and demos.
 */
(function ( $, window, document, undefined ) {

  var pluginName = 'xselectable';

  /**
   * Default configuration options. Can be overriden at plugin initialization
   * time or later using the 'option' method.
   */
  var defaultOptions = {

    // Tolerance, in pixels, for when selecting should start. If specified,
    // selecting will not start until after mouse is dragged beyond distance.
    distance: 0,

    // Whether the selectable behavior is enabled or not.
    disabled: false,

    // Prevents selecting if you start on elements matching the selector.
    cancel: ':input,option',

    // The matching child elements will be made able to be selected.
    filter: '*',

    // The minimum pixel distance, from the selectable container border that
    // should trigger scrolling.
    scrollingThreshold: 100,

    // A multiplier to increase/decrease scrolling speed.
    scrollSpeedMultiplier: 1,

    // Custom scroller implementation. If null, the default one is used.
    // If provided, it must be a function that accepts the element upon which
    // the plugin is applied and returns an object implementing the required
    // scroller methods (getScrollableDistance, scroll,getScrollOffset). See
    // 'defaultScroller' for details.
    scroller: null,

    // Custom positioner implementation. The positioner is responsible for
    // computing selectable elements' positions when the selection gesture
    // starts, in order to correctly compute when the selection box touches
    // a selectable element.
    //
    // The default implementation computes selectables' positions via offset
    // measurement. This works accurately if the element the plugin applies to
    // (the selection container) is their offset parent.
    //
    // The default implementation recomputes selectables' positions every time
    // the selection gesture starts. This may be inefficient when many
    // selectable elements are present.
    //
    // Custom implementations may be provided to overcome the above
    // limitations. If provided, it must be a function that accepts a
    // selectable element (i.e. any element matching the 'filter' option) and
    // return an object containing the 'top', 'left', 'width', and 'height'
    // properties.
    //
    // 'top' and 'left' must define the distance, in pixels, of the top-left
    // corner of the selectable from the top-left corner of the selection
    // container, accurate at the time the call is made. 'width' and 'height'
    // must define the outer width and height (including border, but not
    // margin) of the selectable element.
    positioner: null
  };

  /**
   * Default scroller. It scrolls the selection container viewport using
   * native browser scrolling mechanisms whenever the selection box comes
   * close to the viewport borders.
   *
   * @param {!Element} el The selection container, i.e. the element to which the
   *     plugin is applied to.
   */
  var defaultScroller = function(el) {

    var containerDimensions = $(el).data(pluginName).containerDimensions;

    /**
     * Returns the available distance the selection container viewport can
     * still be scrolled before reaching the selection container borders.
     *
     * @return {!Array.<number>} Available scrolling distances, respectively
     *     from the following borders: top, right, bottom, left.
     */
    function getScrollableDistances() {
      return [
        el.scrollTop,
        el.scrollWidth - el.scrollLeft - containerDimensions.width,
        el.scrollHeight - el.scrollTop - containerDimensions.height,
        el.scrollLeft
      ];
    }

    /**
     * Scrolls the selection container viewport by the required amount.
     *
     * @param {string} scrollAxis The scrolling axis, either 'vertical' or
     *     'horizontal'.
     * @param {number} shift The scrolling amount, in pixels. If positive the
     *     scrolling direction should be downward / rightward. If negative,
     *     upward / leftward.
     */
    function scroll(scrollAxis, shift) {
      var property = scrollAxis == 'vertical' ? 'scrollTop' : 'scrollLeft';
      el[property] += shift;
    }

    /**
     * Returns the offset, in pixels, that should be added to selectable
     * elements' positions (as computed by the plugin 'positioner'), to take
     * into account scrolling.
     *
     * This is not relevant when native browser scrolling is used, but comes
     * into play when scrolling is emulated via container offsets (for Google
     * Maps-like scrolling behavior).
     *
     * @return {!Object.<string, number>} An object containing the 'top' and
     *     'left' properties, pointing respectively to the top and left offset
     *     to add.
     */
    function getScrollOffset() {
      return {top: 0, left: 0};
    }

    return {
      getScrollableDistances: getScrollableDistances,
      scroll: scroll,
      getScrollOffset: getScrollOffset
    };
  };

  /**
   * Default positioner. It computes selectable elements' positions, necessary
   * to identify selected elements as the selection box is dragged around.
   *
   * This default implementation computes selectables' positions via offset
   * measurement. This works accurately if the element the plugin applies to
   * (the selection container) is their offset parent.
   *
   * @param {!Element} selectable A selectable element, i.e. any element
   *     matching the plugin 'filter' option.
   * @return {!Object.<string, number>} An object containing the 'top', 'left',
   *     'width' and 'height' properties. 'top' and 'left' define the distance,
   *     in pixels, of the top-left corner of the selectable from the top-left
   *     corner of the selection container, accurate at the time the call is
   *     made. 'width' and 'height' define the outer width and height
   *     (including border, but not margin) of the selectable element.
   */
  var defaultPositioner = function(selectable) {
    return {
      'top': selectable.offsetTop,
      'left': selectable.offsetLeft,
      'width': selectable.offsetWidth,
      'height': selectable.offsetHeight
    };
  };

  var sign = function(i) {
    return i > 0 ? 1 : i < 0 ? -1 : 0;
  };

  /**
   * Creates the selection box and the glass panel that isolates selectable
   * elements from the selection gesture events (required to prevent Flash
   * grabbing mouseup events for selections ending on top of Flash embeds).
   */
  var createSelectionBox = function() {
    var $this = $(this),
        data = $this.data(pluginName);

    data.selectionGlass = $(
      '<div />', {'class': pluginName + '-glass'}).css({
      'position': 'absolute',
      'top': 0,
      'left': 0,
      'height': this.scrollHeight,
      'width': this.scrollWidth,
      'overflow': 'hidden'}).appendTo($this);
    data.selectionBox = $(
      '<div />', {'class': pluginName + '-box'}).css({
      'position': 'absolute'
      }).appendTo(data.selectionGlass);
  };

  /**
   * Initializes all the selectable elements' when the selection gesture
   * starts. This includes caching their current position and clearing any
   * previous selection.
   */
  var initSelectablesOnGestureStart = function() {
    var self = this,
        $this = $(this),
        data = $this.data(pluginName);

    var selectables = [];
    $this.find(data.options.filter).each(function() {
      var selectable =
        (data.options.positioner || defaultPositioner).call(self, this);
      selectable.element = this;
      selectable.selected = false;
      selectables.push(selectable);
    }).removeClass(pluginName + '-selected');
    data.selectables = selectables;
  };

  /**
   * Updates the selection box position and sizing to match the distance
   * travelled from the position where the selection gesture started and
   * the current mouse position.
   */
  var updateSelectionBox = function(evt) {
    var data = $(this).data(pluginName);
    data.selectionBoxExtents = {
      'top':
          Math.min(data.startPosition.pageY, evt.pageY) -
          data.containerDimensions.top +
          this.scrollTop,
      'left':
          Math.min(data.startPosition.pageX, evt.pageX) -
          data.containerDimensions.left +
          this.scrollLeft,
      'height': Math.abs(data.startPosition.pageY - evt.pageY),
      'width': Math.abs(data.startPosition.pageX - evt.pageX)
    };
    data.selectionBox.css(data.selectionBoxExtents);
  };

  /**
   * Triggers the selection container viewport scrolling, if the selection
   * box is being dragged too close to the viewport borders.
   *
   * @param {!Event} evt The last mousemove event received.
   * @param {number?} scrollTimestamp The timestamp at which the last scrolling
   *     operation was performed. Undefined if a mouse movement occurred in
   *     between.
   */
  var updateViewportScrolling = function(evt, scrollTimestamp) {
    var $this = $(this),
        data = $this.data(pluginName),
        scroller = data.scroller,
        containerDimensions = data.containerDimensions,
        threshold = data.options.scrollingThreshold,
        scrollSpeedMultiplier = data.options.scrollSpeedMultiplier;

    if (data.scrollingTimeout) {
      window.clearTimeout(data.scrollingTimeout);
      delete data.scrollingTimeout;
    }

    var scrollMetrics = [
      { // top
        distance: Math.max(evt.pageY - containerDimensions.top, 0),
        direction: -1,
        scrollAxis: 'vertical',
        positionProperty: 'pageY'
      },
      { // right
        distance: Math.max(
            containerDimensions.left + containerDimensions.width - evt.pageX,
            0),
        direction: 1,
        scrollAxis: 'horizontal',
        positionProperty: 'pageX'
      },
      { // bottom
        distance: Math.max(
            containerDimensions.top + containerDimensions.height - evt.pageY,
            0),
        direction: 1,
        scrollAxis: 'vertical',
        positionProperty: 'pageY'
      },
      { // left
        distance: Math.max(evt.pageX - containerDimensions.left, 0),
        direction: -1,
        scrollAxis: 'horizontal',
        positionProperty: 'pageX'
      }
    ];

    var scrolled = false;
    var scrollableDistances = scroller.getScrollableDistances();

    // Compute a multiplier based on the actual amount of time that
    // passed since the last scrolling update, to keep scrolling speed
    // constant as if scrolling occurred at exactly 60fps.
    var scrollLagMultiplier = scrollTimestamp ?
        (new Date().getTime() - scrollTimestamp) / 16 : 1;
    scrollTimestamp = new Date().getTime();

    for (var i = scrollMetrics.length - 1; i >= 0; i--) {
      var metric = scrollMetrics[i];
      var available = scrollableDistances[i];

      if (
          // We are within a minimum threshold distance from the border, and
          metric.distance < threshold &&

          // We still have room for scrolling, and
          available > 0 &&

            // We are moving toward the border
            sign(
                data.curPosition[metric.positionProperty] -
                data.lastPosition[metric.positionProperty]) ==
                    metric.direction
        ) {

        // Compute the scrolling shift: the closer we push the mouse toward the
        // border, the bigger the shift.
        var shift = metric.direction *
            Math.min(available, Math.ceil((threshold - metric.distance) / 10)) *
            scrollLagMultiplier * scrollSpeedMultiplier;

        // Scroll in the desired direction
        scroller.scroll(metric.scrollAxis, shift);

        // Move the selection box starting position in the opposite direction
        // by the same amount, to keep its origin fixed.
        data.startPosition[metric.positionProperty] -= shift;
        data.curPosition[metric.positionProperty] -= shift;
        scrolled = true;
      }
    }

    // If scrolling start, continue scrolling until another mouse movement is
    // detected (to handle the case when the mouse is moved toward a viewport
    // border and left stationary for the scrolling to continue at a constant
    // speed).
    if (scrolled) {
      data.scrollingTimeout = window.setTimeout($.proxy(
          function() { tick.call(this, evt, scrollTimestamp); }, this),
          16);  // try to keep scrolling at 60fps.
    }
  };


  /**
   * Update the selection status of all selectable elements', depending on
   * whether the selection box currently touches them or not. Triggers
   * 'selecting' and 'unselecting' events.
   */
  var markSelected = function() {
    var $this = $(this),
        data = $this.data(pluginName),
        offset = data.scroller.getScrollOffset();

    for (var i = data.selectables.length - 1; i >=0 ; i--) {
      var selectable = data.selectables[i];
      if (overlap(data.selectionBoxExtents, selectable, offset)) {
        if (!selectable.selected) {
          $(selectable.element).addClass(pluginName + '-selected');
          selectable.selected = true;
          $this.trigger(
              pluginName + 'selecting',
              {'selecting': selectable.element});
        }
      } else if (selectable.selected) {
        $(selectable.element).removeClass(pluginName + '-selected');
        selectable.selected = false;
        $this.trigger(
            pluginName + 'unselecting',
            {'unselecting': selectable.element});
      }
    }
  };

  var overlap = function(rectangle1, rectangle2, offset) {
    return (
      overlap1D(rectangle1.top, rectangle1.height,
                rectangle2.top + offset.top, rectangle2.height) &&
      overlap1D(rectangle1.left, rectangle1.width,
                rectangle2.left + offset.left, rectangle2.width));
  };

  var overlap1D = function(start1, width1, start2, width2) {
    var end1 = start1 + width1, end2 = start2 + width2;
    return ((start2 >= start1 && start2 <= end1) ||
        (end2 >= start1 && end2 <= end1) ||
        (start2 <= start1 && end2 >= end1));
  };

  /**
   * Reacts to the user pressing the mouse down inside the selectable container
   * viewport, possibly initiating a selection gesture.
   */
  var onMouseDown = function(evt) {
    var $this = $(this),
        data = $this.data(pluginName);

    // Do not start selection if it's not done with the left button.
    if (evt.which != 1) {
      return;
    }

    // Prevent selection from starting on any element matched by
    // or contained within the selector specified by the 'cancel'
    // option.
    var selector =
        [data.options.cancel, data.options.cancel + ' *'].join(',');
    if (!!data.options.cancel &&
        $(evt.target).is(selector)) {
      return;
    }

    // Prevent selection if the mouse is being pressed down on a scrollbar
    // (which is still technically part of the selectable element).
    if (evt.pageX > $this.offset().left + this.clientWidth ||
        evt.pageY > $this.offset().top + this.clientHeight) {
      return;
    }

    // Trigger the selection 'start' event.
    $this.trigger(pluginName + 'start');

    // Record the initial position of the container, with respect to the
    // document. Also include the current border size (assuming equal
    // top/bottom and right/left border sizes).
    data.containerDimensions = {
      'top': $this.offset().top +
             ($this.outerHeight(false) - $this.innerHeight())/2,
      'left': $this.offset().left +
              ($this.outerWidth(false) - $this.innerWidth())/2,
      'width': this.clientWidth,
      'height': this.clientHeight
    };

    // Record the initial position of the mouse event, with respect to the
    // document (_not_ including the scrolling position of the selection
    // container).
    data.startPosition = {'pageX': evt.pageX, 'pageY': evt.pageY};
    data.curPosition = {'pageX': evt.pageX, 'pageY': evt.pageY};

    // Init the scroller
    data.scroller =
        (data.options.scroller || defaultScroller).call(this, this);

    // Start listening for mouseup (to terminate selection), movement and
    // wheel scrolling. Mouseups and movement can occur everywhere in the
    // document, if the user moves the mouse outside the selection container.
    data.mouseupHandler = $.proxy(onMouseUp, this);
    $(document).bind('mouseup.' + pluginName, data.mouseupHandler);
    $(document).bind('mousemove.' + pluginName, $.proxy(tick, this));

    // Disable mousewheel scrolling during box selections.
    $this.bind('mousewheel.' + pluginName, function(evt) {
      evt.preventDefault(); return false;
    });

    // Prevent the default browser dragging to occur.
    evt.preventDefault();
  };

  /**
   * Updates the plugin state during a selection operation in response either to
   * mouse dragging by the user, or repeated scrolling updates because the
   * selection box is skimming the scrolling container viewport borders.
   *
   * @param {!Event} evt The last mousemove event received.
   * @param {number?} scrollTimestamp The timestamp at which the last scrolling
   *     operation was performed. Undefined if this function is being invoked
   *     in response to mouse dragging.
   */
  var tick = function(evt, scrollTimestamp) {
    var $this = $(this),
        data = $this.data(pluginName),
        distance = data.options.distance;

    // Do nothing if we haven't yet moved past the distance threshold.
    if (!data.selectionBox &&
        Math.abs(data.startPosition.pageX - evt.pageX) < distance &&
        Math.abs(data.startPosition.pageY - evt.pageY) < distance) {
      return;
    }

    data.lastPosition = data.curPosition;
    data.curPosition = {'pageX': evt.pageX, 'pageY': evt.pageY};

    if (!data.selectionBox) {
      // Create the selection box if we haven't created it yet.
      createSelectionBox.apply(this);

      // Compute the initial position and sizing of each selectable
      // object.
      initSelectablesOnGestureStart.apply(this);
    }

    // scroll the viewport if the mouse moves near the viewport boundaries.
    updateViewportScrolling.call(this, evt, scrollTimestamp);

    // update the selection box position and size.
    updateSelectionBox.call(this, evt);

    // mark elements as selected / deselected based on the current
    // selection box extent.
    markSelected.call(this);
  };

  /**
   * Terminates a selection gesture.
   */
  var onMouseUp = function(evt) {
    var $this = $(this),
        data = $this.data(pluginName);

    if (data.scrollingTimeout) {
      window.clearTimeout(data.scrollingTimeout);
      delete data.scrollingTimeout;
    }

    $this.unbind('mousewheel.' + pluginName);
    $(document).unbind('mousemove.' + pluginName);
    $(document).unbind('mouseup.' + pluginName, data.mouseupHandler);
    data.mouseupHandler = undefined;

    if (!!data.selectionBox) {
      data.selectionBox.remove();
      delete data.selectionBox;

      data.selectionGlass.remove();
      delete data.selectionGlass;

      var selected = [], unselected = [];
      for (var i = data.selectables.length - 1; i >= 0; i--) {
        (data.selectables[i].selected ? selected : unselected).push(
            data.selectables[i].element);
      }
      delete data.selectables;

      // If selection ever started (we moved past the threshold distance),
      // fire the completion events.
      $this.trigger(pluginName + 'selected', {'selected': selected});
      $this.trigger(pluginName + 'unselected', {'unselected': unselected});
      $this.trigger(pluginName + 'stop');
    }
  };

  // Public plugin methods.
  var methods = {

    /**
     * Actives the plugin on the given set of elements.
     *
     * @param {Object} options The plugin options.
     */
    init: function(options) {
      this.each(function() {
        $(this).data(
            pluginName,
            {'options': $.extend({}, defaultOptions, options)});
      });
      if (!!this.data(pluginName).options.disabled) {
        return this;
      }
      return methods.enable.apply(this);
    },

    /**
     * Deactives the plugin on the given set of elements, clearing any
     * additional data structures and event listeners created in the process.
     *
     * Note that deactivating the plugin while a selection operation is in
     * progress will lead to undefined results.
     */
    destroy: function() {
      methods.disable.apply(this);
      return this.removeData(pluginName);
    },

    /**
     * Enables selection gestures.
     */
    enable: function() {
      return this.each(function() {
        var $this = $(this),
            data = $this.data(pluginName);

        data.options.disabled = false;
        $this.bind('mousedown.' + pluginName, onMouseDown);
      });
    },

    /**
     * Disables selection gestures.
     */
    disable: function() {
      return this.each(function() {
        var $this = $(this),
            data = $this.data(pluginName);

        data.options.disabled = true;
        $this.unbind('.' + pluginName);
      });
    },

    /**
     * Get or set any selectable option. If no value is specified, will act as
     * a getter.
     *
     * @param {string} key The option key to get or set.
     * @param {Object=} opt_value If undefined, the method will act as a
     *     getter, otherwise the option value will be set to the given one
     *     (null values may be used to reset certain properties to their
     *     default status).
     * @return {Object?} Either the request option value (when acting as
     *     getter, or 'this' for chainability when acting as setter.
     */
    option: function(key, opt_value) {
      var options = this.first().data(pluginName).options;
      if (opt_value === undefined) {
        return options[key];
      } else {
        options[key] = opt_value;
        if (key == 'disabled') {
          (!!opt_value) ?
              methods.disable.apply(this) : methods.enable.apply(this);
        }
        return this;
      }
    }
  };

  // Method dispatcher.
  $.fn[pluginName] = function( method ) {

    if ( methods[method] ) {
      return methods[ method ].apply(
          this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error('Method ' +  method + ' does not exist on jQuery.' + pluginName);
    }

  };
})(jQuery, window, document);
