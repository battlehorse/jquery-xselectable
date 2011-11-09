# jQuery-xselectable

**jQuery-xselectable** is a jQuery plugin to enable DOM elements to be selectable. It lets you draw selection boxes with your cursor to select custom webpage elements.

It behaves similarly to [jQuery UI 'selectable'](http://jqueryui.com/demos/selectable/), but it offers a few extra features, such as support for scrollable containers and selection over Flash embeds.

## Features

* **Selection over Flash embeds**. Flash embeds would normally swallow click events, causing the selection gesture not to terminate if the mouse were to be released within the Flash embed. This plugin separates the selection box from the selectable elements via glass panels to fix that.
* **Scrolling support**. When the selectable container overflows the window viewport or the selectable elements overflow the selectable viewable viewport (causing scrollbars to appear on it) and the selection box is dragged toward the viewport borders, the viewport (either the document or the selectable) is scrolled accordingly to let the selection gesture continue until the viewport scrolling limits are hit. In practice, this means you don't have to worry about scrolling, either of the browser window or the selectable element itself (if you configured it to have scrollbars). Scrolling management is pluggable, which allows for different scrolling implementations (in addition to the default one which relies on native browser scrolling functionality). For example, a Google Maps-like endless scrolling can be easily implemented. The plugin tries to keep scrolling at 60fps.
* Selection does not inadvertently trigger when the mouse down event occurs over scrollbars. See [http://bugs.jqueryui.com/ticket/4441](http://bugs.jqueryui.com/ticket/4441).
* The plugin doesn't require any of jQuery UI machinery. It can be used directly on top of jQuery, possibly reducing the javascript payload used in the hosting page.

**NOTE** that the plugin semantics are similar to jQuery UI 'selectable' ones but not the same. While it's fairly straightforward to replace jQuery UI plugin for this, this pluging is not a 100% compatible drop-in replacement. See the comments on top of the plugin sources for details.

## Demos and documentation

See all the [Demos and Documentation here](http://battlehorse.github.com/jquery-xselectable/)

## License

The plugin is released under the MIT license.

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
