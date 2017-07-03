import * as d3 from 'd3';
import _ from 'lodash';
import { t } from '../../util/locale';


export function uiPanelImagery(context) {
    var background = context.background();
    var currSource = null;
    var currZoom = '';
    var currVintage = '';


    function redraw(selection) {
        if (d3.selectAll('.infobox.hide').size()) return;   // infobox is hidden

        if (currSource !== background.baseLayerSource().name()) {
            currSource = background.baseLayerSource().name();
            currZoom = '';
            currVintage = '';
        }

        selection.html('');

        var list = selection
            .append('ul')
            .attr('class', 'imagery-info');

        list
            .append('li')
            .text(currSource);

        list
            .append('li')
            .text(t('infobox.imagery.zoom') + ': ')
            .append('span')
            .attr('class', 'zoom')
            .text(currZoom);

        list
            .append('li')
            .text(t('infobox.imagery.vintage') + ': ')
            .append('span')
            .attr('class', 'vintage')
            .text(currVintage);

        if (!currVintage) {
            debouncedGetVintage(selection);
        }

        var toggle = context.getDebug('tile') ? 'hide_tiles' : 'show_tiles';

        selection
            .append('a')
            .text(t('infobox.imagery.' + toggle))
            .attr('href', '#')
            .attr('class', 'button button-toggle-tiles')
            .on('click', function() {
                d3.event.preventDefault();
                context.setDebug('tile', !context.getDebug('tile'));
                selection.call(redraw);
            });
    }


    var debouncedGetVintage = _.debounce(getVintage, 250);
    function getVintage(selection) {
        var tile = d3.select('.layer-background img.tile-center');   // tile near viewport center
        if (tile.empty()) return;

        var d = tile.datum(),
            zoom = (d && d.length >= 3 && d[2]) || Math.floor(context.map().zoom()),
            center = context.map().center();

        currZoom = String(zoom);
        selection.selectAll('.zoom')
            .text(currZoom);

        if (!d || !d.length >= 3) return;
        background.baseLayerSource().getVintage(center, d, function(err, result) {
            currVintage = (result && result.range) || t('infobox.imagery.unknown');
            selection.selectAll('.vintage')
                .text(currVintage);
        });
    }


    var panel = function(selection) {
        selection.call(redraw);

        context.map()
            .on('drawn.info-imagery', function() {
                selection.call(redraw);
            })
            .on('move.info-imagery', function() {
                selection.call(debouncedGetVintage);
            });

    };

    panel.off = function() {
        context.map()
            .on('drawn.info-imagery', null)
            .on('move.info-imagery', null);
    };

    panel.id = 'imagery';
    panel.title = t('infobox.imagery.title');
    panel.key = t('infobox.imagery.key');


    return panel;
}
