import { interpolateNumber as d3_interpolateNumber } from 'd3-interpolate';
import { select as d3_select } from 'd3-selection';
import { Extent } from '@rapid-sdk/math';
import { utilArrayIdentical } from '@rapid-sdk/util';
import _throttle from 'lodash-es/throttle';

import { utilFastMouse } from '../util';
import { osmEntity, osmNote, QAItem } from '../osm';
import { uiDataEditor } from './data_editor';
import { uiFeatureList } from './feature_list';
import { uiInspector } from './inspector';
import { uiImproveOsmEditor } from './improveOSM_editor';
import { uiKeepRightEditor } from './keepRight_editor';
import { uiOsmoseEditor } from './osmose_editor';
import { uiNoteEditor } from './note_editor';
import { uiRapidFeatureInspector } from './rapid_feature_inspector';


export function uiSidebar(context) {
  const editor = context.systems.editor;
  const l10n = context.systems.l10n;
  const ui = context.systems.ui;

  const inspector = uiInspector(context);
  const rapidInspector = uiRapidFeatureInspector(context);
  const dataEditor = uiDataEditor(context);
  const noteEditor = uiNoteEditor(context);
  const improveOsmEditor = uiImproveOsmEditor(context);
  const keepRightEditor = uiKeepRightEditor(context);
  const osmoseEditor = uiOsmoseEditor(context);

  let _current;
  let _wasRapid = false;
  let _wasData = false;
  let _wasNote = false;
  let _wasQaItem = false;


    function sidebar(selection) {
        var container = context.container();
        var minWidth = 240;
        var sidebarWidth;
        var containerWidth;
        var dragOffset;

        // Set the initial width constraints
        selection
            .style('min-width', minWidth + 'px')
            .style('max-width', '400px')
            .style('width', '33.3333%');

        var resizer = selection
            .append('div')
            .attr('class', 'sidebar-resizer')
            .on('pointerdown.sidebar-resizer', pointerdown);

        var downPointerId, lastClientX, containerLocGetter;

        function pointerdown(d3_event) {
            if (downPointerId) return;

            if ('button' in d3_event && d3_event.button !== 0) return;

            downPointerId = d3_event.pointerId || 'mouse';

            lastClientX = d3_event.clientX;

            containerLocGetter = utilFastMouse(container.node());

            // offset from edge of sidebar-resizer
            dragOffset = utilFastMouse(resizer.node())(d3_event)[0] - 1;

            sidebarWidth = selection.node().getBoundingClientRect().width;
            containerWidth = container.node().getBoundingClientRect().width;
            var widthPct = (sidebarWidth / containerWidth) * 100;
            selection
                .style('width', widthPct + '%') // lock in current width
                .style('max-width', '85%'); // but allow larger widths

            resizer.classed('dragging', true);

            d3_select(window)
                .on('touchmove.sidebar-resizer', function(d3_event) {
                    // disable page scrolling while resizing on touch input
                    d3_event.preventDefault();
                }, { passive: false })
                .on('pointermove.sidebar-resizer', pointermove)
                .on('pointerup.sidebar-resizer pointercancel.sidebar-resizer', pointerup);
        }

        function pointermove(d3_event) {
            if (downPointerId !== (d3_event.pointerId || 'mouse')) return;

            d3_event.preventDefault();

            var dx = d3_event.clientX - lastClientX;

            lastClientX = d3_event.clientX;

            var isRTL = l10n.isRTL();
            var scaleX = isRTL ? 0 : 1;
            var xMarginProperty = isRTL ? 'margin-right' : 'margin-left';

            var x = containerLocGetter(d3_event)[0] - dragOffset;
            sidebarWidth = isRTL ? containerWidth - x : x;

            var isCollapsed = selection.classed('collapsed');
            var shouldCollapse = sidebarWidth < minWidth;

            selection.classed('collapsed', shouldCollapse);

            if (shouldCollapse) {
                if (!isCollapsed) {
                    selection
                        .style(xMarginProperty, '-400px')
                        .style('width', '400px');

                    ui.resize([(sidebarWidth - dx) * scaleX, 0]);
                }

            } else {
                var widthPct = (sidebarWidth / containerWidth) * 100;
                selection
                    .style(xMarginProperty, null)
                    .style('width', widthPct + '%');

                if (isCollapsed) {
                    ui.resize([-sidebarWidth * scaleX, 0]);
                } else {
                    ui.resize([-dx * scaleX, 0]);
                }
            }
        }

        function pointerup(d3_event) {
            if (downPointerId !== (d3_event.pointerId || 'mouse')) return;

            downPointerId = null;

            resizer.classed('dragging', false);

            d3_select(window)
                .on('touchmove.sidebar-resizer', null)
                .on('pointermove.sidebar-resizer', null)
                .on('pointerup.sidebar-resizer pointercancel.sidebar-resizer', null);
        }

        var featureListWrap = selection
            .append('div')
            .attr('class', 'feature-list-pane')
            .call(uiFeatureList(context));

        var inspectorWrap = selection
            .append('div')
            .attr('class', 'inspector-hidden inspector-wrap');

        var hoverModeSelect = function(targets) {
            context.container().selectAll('.feature-list-item button').classed('hover', false);

            if (context.selectedIDs().length > 1 &&
                targets && targets.length) {

                var elements = context.container().selectAll('.feature-list-item button')
                    .filter(function(node) {
                        return targets.indexOf(node) !== -1;
                    });

                if (!elements.empty()) {
                    elements.classed('hover', true);
                }
            }
        };

        sidebar.hoverModeSelect = _throttle(hoverModeSelect, 200);

        function hover(targets) {
            const graph = editor.staging.graph;
            let datum = targets && targets.length && targets[0];

            if (datum && datum.__featurehash__) { // hovering on data
                _wasData = true;
                sidebar
                    .show(dataEditor.datum(datum));

                selection.selectAll('.sidebar-component')
                    .classed('inspector-hover', true);

            } else if (datum && datum.__fbid__) { // hovering on Rapid data
                _wasRapid = true;
                sidebar
                    .show(rapidInspector.datum(datum));

                selection.selectAll('.sidebar-component')
                    .classed('inspector-hover', true)
                    .classed('rapid-inspector-fadein', true);


            } else if (datum instanceof osmNote) {
                if (context.mode?.id === 'drag-note') return;
                _wasNote = true;

                var osm = context.services.osm;
                if (osm) {
                    datum = osm.getNote(datum.id); // marker may contain stale data - get latest
                }

                sidebar
                    .show(noteEditor.note(datum));

                selection.selectAll('.sidebar-component')
                    .classed('inspector-hover', true);

            } else if (datum instanceof QAItem) {
                _wasQaItem = true;

                var errService = context.services[datum.service];
                if (errService) {
                    // marker may contain stale data - get latest
                    datum = errService.getError(datum.id);
                }

                // Currently only three possible services
                var errEditor;
                if (datum.service === 'keepRight') {
                    errEditor = keepRightEditor;
                } else if (datum.service === 'osmose') {
                    errEditor = osmoseEditor;
                } else {
                    errEditor = improveOsmEditor;
                }

                context.container().selectAll('.qaItem.' + datum.service)
                    .classed('hover', function(d) { return d.id === datum.id; });

                sidebar
                    .show(errEditor.error(datum));

                selection.selectAll('.sidebar-component')
                    .classed('inspector-hover', true);

            } else if (!_current && (datum instanceof osmEntity) && graph.hasEntity(datum)) {
                featureListWrap
                    .classed('inspector-hidden', true);

                inspectorWrap
                    .classed('inspector-hidden', false)
                    .classed('inspector-hover', true);

                if (!inspector.entityIDs() || !utilArrayIdentical(inspector.entityIDs(), [datum.id]) || inspector.state() !== 'hover') {
                    inspector
                        .state('hover')
                        .entityIDs([datum.id])
                        .newFeature(false);

                    inspectorWrap
                        .call(inspector);
                }

            } else if (!_current) {
                featureListWrap
                    .classed('inspector-hidden', false);
                inspectorWrap
                    .classed('inspector-hidden', true);
                inspector
                    .state('hide');

            } else if (_wasRapid || _wasData || _wasNote || _wasQaItem) {
                _wasRapid = false;
                _wasNote = false;
                _wasData = false;
                _wasQaItem = false;
                context.container().selectAll('.layer-ai-features .hover').classed('hover', false);
                context.container().selectAll('.note').classed('hover', false);
                context.container().selectAll('.qaItem').classed('hover', false);
                sidebar.hide();
            }
        }

        sidebar.hover = _throttle(hover, 200);


        sidebar.intersects = function(wgs84Extent) {
            var rect = selection.node().getBoundingClientRect();
            return wgs84Extent.intersects(new Extent(
                context.projection.invert([0, rect.height]),
                context.projection.invert([rect.width, 0])
            ));
        };


        sidebar.select = function(ids, newFeature) {
            sidebar.hide();

            if (ids && ids.length) {
                const graph = editor.staging.graph;
                const entity = ids.length === 1 && graph.entity(ids[0]);
                if (entity && newFeature && selection.classed('collapsed')) {
                    // uncollapse the sidebar
                    var extent = entity.extent(graph);
                    sidebar.expand(sidebar.intersects(extent));
                }

                featureListWrap
                    .classed('inspector-hidden', true);

                inspectorWrap
                    .classed('inspector-hidden', false)
                    .classed('inspector-hover', false);

                // reload the UI even if the ids are the same since the entities
                // themselves may have changed
                inspector
                    .state('select')
                    .entityIDs(ids)
                    .newFeature(newFeature);

                inspectorWrap
                    .call(inspector);

            } else {
                inspector
                    .state('hide');
            }
        };


        sidebar.showPresetList = function(...args) {
            inspector.showPresetList(...args);
        };

        sidebar.showEntityEditor = function(...args) {
            inspector.showEntityEditor(...args);
        };


        sidebar.show = function(component, element) {
            featureListWrap
                .classed('inspector-hidden', true);
            inspectorWrap
                .classed('inspector-hidden', true);

            if (_current) _current.remove();
            _current = selection
                .append('div')
                .attr('class', 'sidebar-component')
                .call(component, element);
        };


        sidebar.hide = function() {
            featureListWrap
                .classed('inspector-hidden', false);
            inspectorWrap
                .classed('inspector-hidden', true);

            if (_current) _current.remove();
            _current = null;
        };


        sidebar.expand = function(moveMap) {
            if (selection.classed('collapsed')) {
                sidebar.toggle(moveMap);
            }
        };


        sidebar.collapse = function(moveMap) {
            if (!selection.classed('collapsed')) {
                sidebar.toggle(moveMap);
            }
        };


        sidebar.toggle = function(moveMap) {
            // Don't allow sidebar to toggle when the user is in the walkthrough.
            if (context.inIntro) return;

            var isCollapsed = selection.classed('collapsed');
            var isCollapsing = !isCollapsed;
            var isRTL = l10n.isRTL();
            var scaleX = isRTL ? 0 : 1;
            var xMarginProperty = isRTL ? 'margin-right' : 'margin-left';

            sidebarWidth = selection.node().getBoundingClientRect().width;

            // switch from % to px
            selection.style('width', sidebarWidth + 'px');

            var startMargin, endMargin, lastMargin;
            if (isCollapsing) {
                startMargin = lastMargin = 0;
                endMargin = -sidebarWidth;
            } else {
                startMargin = lastMargin = -sidebarWidth;
                endMargin = 0;
            }

            if (!isCollapsing) {
                // unhide the sidebar's content before it transitions onscreen
                selection.classed('collapsed', isCollapsing);
            }

            selection
                .transition()
                .style(xMarginProperty, endMargin + 'px')
                .tween('panner', function() {
                    var i = d3_interpolateNumber(startMargin, endMargin);
                    return function(t) {
                        var dx = lastMargin - Math.round(i(t));
                        lastMargin = lastMargin - dx;
                        ui.resize(moveMap ? undefined : [dx * scaleX, 0]);
                    };
                })
                .on('end', function() {
                    if (isCollapsing) {
                        // hide the sidebar's content after it transitions offscreen
                        selection.classed('collapsed', isCollapsing);
                    }
                    const resizeNode = context.pixi.view.parentNode;
                    context.pixi.resize(resizeNode.clientWidth, resizeNode.clientHeight);
                    // switch back from px to %
                    if (!isCollapsing) {
                        var containerWidth = container.node().getBoundingClientRect().width;
                        var widthPct = (sidebarWidth / containerWidth) * 100;
                        selection
                            .style(xMarginProperty, null)
                            .style('width', widthPct + '%');
                    }
                });
        };

        // toggle the sidebar collapse when double-clicking the resizer
        resizer.on('dblclick', function(d3_event) {
            d3_event.preventDefault();
            if (d3_event.sourceEvent) {
                d3_event.sourceEvent.preventDefault();
            }
            sidebar.toggle();
        });
    }

    sidebar.showPresetList = function() {};
    sidebar.showEntityEditor = function() {};
    sidebar.hover = function() {};
    sidebar.hover.cancel = function() {};
    sidebar.intersects = function() {};
    sidebar.select = function() {};
    sidebar.show = function() {};
    sidebar.hide = function() {};
    sidebar.expand = function() {};
    sidebar.collapse = function() {};
    sidebar.toggle = function() {};

    return sidebar;
}
