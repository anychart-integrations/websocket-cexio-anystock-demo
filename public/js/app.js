function setColClass($el) {
  // column count for row
  var ROW_COUNT = 12;
  var COLUMN_COUNT = 3;
  var index = $el.find('.col-sm-4').length;
  var lastIndex = $el.find('.col-sm-4').last().index();
  var colClass;

  if (index === COLUMN_COUNT) {
    return
  }

  if (index > COLUMN_COUNT) {
    while (index > COLUMN_COUNT) {
      index -= COLUMN_COUNT;
    }
  }

  colClass = ROW_COUNT / index;

  while (index) {
    --index;
    $el.find($("[class*='col-sm-']"))
      .eq(lastIndex - index)
      .removeClass('col-sm-4')
      .addClass('col-sm-' + colClass);
  }
}

function getInputLabelText(keyText) {
  var text = '';
  var result = [];

  keyText.split(/(?=[A-Z])/).filter(function(item) {
    if (item.length === 1) {
      text += item;
    } else {
      text += ' ';
      text += item;
    }
  });
  text = text.trim();
  text = text[0].toUpperCase() + text.substr(1);

  text.split(' ').filter(function(item, index) {
    if (item.length === 1 && index !== text.split(' ').length - 1) {
      result.push(item + '-');
    } else {
      result.push(item);
    }
  });

  return result.join(' ').replace(/-\s/, '-');
}

(function() {
  initTooltip('bottom');

  var $strokeSettings = $('#select-stroke-settings');
  var $colorPickerFill = $('.color-picker[data-color="fill"]');
  var $colorPickerStroke = $('.color-picker[data-color="stroke"]');
  var $annotationLabel;
  var $fontSize = $('#select-font-size');
  var $fontSettings = $('#select-font-style');
  var $labelMethod = $('[data-label-method]');

  $('#select-stroke-settings').val([1, 6]).selectpicker('refresh');
  var annotationsColor;

  // page UI elements
  createPageColorPicker();


  var $seriesTypeSelect = $('#seriesTypeSelect');
  var $indicatorTypeSelect = $('#indicatorTypeSelect');
  var $indicatorSettingsModal = $('#indicatorSettingsModal');
  var $resetBtn = $('#resetButton');
  var $addIndicatorBtn = $('#addIndicatorButton');
  var $indicatorNavPanel = $('#indicatorNavPanel');
  var $indicatorForm = $('#indicatorForm');
  var $loader = $('#loader');
  var $themeSelect = $('#themeSelect');

  var appSettingsCache = {};
  appSettingsCache['data'] = {};
  appSettingsCache['chartType'] = $seriesTypeSelect.val();
  appSettingsCache['indicators'] = {};

  var chartContainer = 'chart-container';

  var indicatorsSettings = {
    name: '',
    plotIndex: 0,
    defaultSettings: {},
    seriesType: [
      'area',
      'column',
      'jump-line',
      'line',
      'marker',
      'spline',
      'spline-area',
      'step-area',
      'step-line',
      'stick',
      'range-area',
      'candlestick',
      'ohlc'
    ]
  };
  //
  var chart;
  var dataTable;
  var mapping;
  var indicatorlist = [];
  //default theme after launch
  var theme = $themeSelect.val();
  //seconds counter
  var timer = 0;
  var secondCounter = null;

  var inputHtml =
    '<div class="col-sm-4">' +
    '<div class="form-group" id="indicatorFormGroup">' +
    '<label for="" class="control-label"></label>' +
    '<input type="number" class="form-control" id="">' +
    '</div>' +
    '</div>';

  var selectHtml =
    '<div class="col-sm-4">' +
    '<div class="form-group" id="indicatorFormGroup">' +
    '<label for="" class="control-label"></label>' +
    '<select class="form-control select show-tick" id=""></select>' +
    '</div>' +
    '</div>';

  var app = {
    createChart: createChart,
    removeChart: removeChart
  };

  // this Sample will properly work only if upload it to a server and access via http or https
  if (window.location.protocol === 'file:') {
    $loader.hide();
    $('.wrapper').hide();
    $('#warning').modal({
      backdrop: 'static',
      keyboard: false
    });
  }

  // get indicators from file indicators.xml
  $.get("indicators.xml", function(data) {
    $(data).find('indicator').each(function(index, item) {
      var indicatorName = $(this).attr('type');
      var description;
      var $option = $('<option></option>');

      // create option and append to indicator type select
      $option.attr({
        'value': indicatorName,
        'title': $(this).find('abbreviation').text(),
        'data-abbr': $(this).find('abbreviation').text(),
        'data-full-text': $(this).find('title').text(),
        'data-plot': $(this).find('plotIndex').text()
      }).text($(this).find('title').text());

      if ($(this).find('[name="plotIndex"]').length) {
        $option.attr('data-plot-index', $(this).find('[name="plotIndex"]').attr('value'));
      }

      $indicatorTypeSelect.append($option);

      indicatorsSettings['defaultSettings'][indicatorName] = {};

      // set indicator settings to indicator object
      $(item).find('defaults').children().each(function() {
        var prop = $(this).attr('name');
        var value = $(this).attr('value');

        switch ($(this).attr('type')) {
          case 'number':
            value = +value;
            break;
          case 'array':
            value = JSON.parse(value);
            break;
        }

        indicatorsSettings['defaultSettings'][indicatorName][prop] = value;
      });

      // description from xml
      description = $(item).find('description').text();

      // save indicator overview
      indicatorsSettings['defaultSettings'][indicatorName]['overview'] = {};
      indicatorsSettings['defaultSettings'][indicatorName]['overview']['title'] = $(item).find('title').text();
      indicatorsSettings['defaultSettings'][indicatorName]['overview']['description'] = description;
    });

    // sort option in select
    var options = $indicatorTypeSelect.find('option').sort(function(a, b) {
      return a.text.toUpperCase().localeCompare(b.text.toUpperCase())
    });
    $indicatorTypeSelect.append(options);

    // init selectpicker
    $indicatorTypeSelect.selectpicker();
  });

  $(window).on('resize', initHeightChart);

  anychart.onDocumentReady(function() {

    app.createChart(chartContainer);

    // event to set chart type
    $seriesTypeSelect.on('change', function() {
      var type = $(this).val();

      // set chart type
      chart.plot().getSeries(0).seriesType(type);
      // save chart type
      appSettingsCache['chartType'] = type;
    });

    // event to set theme
    $themeSelect.on('change', function() {
      theme = $(this).val();

      var json;
      json = chart.plot(0).annotations().toJson(true);
      localStorage.setItem('annotationsList0', json);
      for (var key in appSettingsCache['indicators']) {
        var plotIndex = appSettingsCache['indicators'][key].plotIndex;
        json = chart.plot(plotIndex).annotations().toJson(true);
        localStorage.setItem('annotationsList' + plotIndex, json);
      }


      $('.btn[data-action-type]')['3'].className = 'btn btn-default disabled';

      var currentRange = {};
      currentRange.min = chart.xScale().getMinimum();
      currentRange.max = chart.xScale().getMaximum();
      json = JSON.stringify(currentRange);
      localStorage.setItem('currentRange', json);

      chart.plot().annotations().removeAllAnnotations();

      app.removeChart();
      // reset saved settings
      appSettingsCache['chartType'] = 'line';
      // select series type
      $seriesTypeSelect.val('candlestick').selectpicker('refresh');
      // reset indicators select
      $indicatorTypeSelect.val('').selectpicker('refresh');
      // init, create chart
      app.createChart(chartContainer, true);
    });

    // event to show modal indicator settings
    $indicatorTypeSelect.on('change', function() {

      //saving annotations from all plots

      // console.log(appSettingsCache['indicators']);
      var json;
      json = chart.plot(0).annotations().toJson(true);
      localStorage.setItem('annotationsList0', json);
      for (var key in appSettingsCache['indicators']) {
        var plotIndex = appSettingsCache['indicators'][key].plotIndex;
        json = chart.plot(plotIndex).annotations().toJson(true);
        localStorage.setItem('annotationsList' + plotIndex, json);
      }

      if ($(this).val() === null || $(this).val().length < Object.keys(appSettingsCache.indicators).length) {

        $('.btn[data-action-type]')['3'].className = 'btn btn-default disabled';

        var currentRange = {};
        currentRange.min = chart.xScale().getMinimum();
        currentRange.max = chart.xScale().getMaximum();
        json = JSON.stringify(currentRange);
        localStorage.setItem('currentRange', json);

        app.removeChart();

        if ($(this).val() !== null) {
          for (var keyIndicator in appSettingsCache.indicators) {
            if (!~$(this).val().indexOf(keyIndicator)) {
              delete appSettingsCache.indicators[keyIndicator]
            }
          }
        } else {
          appSettingsCache.indicators = {};
        }

        app.createChart(chartContainer, true);

        return
      }

      for (var i = 0; i < $(this).val().length; i++) {
        if (!~Object.keys(appSettingsCache.indicators).indexOf($(this).val()[i])) {
          // set indicator name
          indicatorsSettings.name = $(this).val()[i];
          break;
        }
      }

      // set plot index
      indicatorsSettings.plotIndex = $(this).find('option[value="' + indicatorsSettings.name + '"]').data().plotIndex;

      // create html if form (input/select)
      createHtmlToIndicatorForm();
      // set default indicator settings to input/select
      setDefaultIndicatorSettings();

      // show indicator settings modal
      $indicatorSettingsModal.modal('show');
      // hide dropdown menu, select
      $indicatorNavPanel.find('.select.open').removeClass('open');
    });

    // remove selected class, if indicator not selected
    $indicatorSettingsModal.on('hidden.bs.modal', function() {
      var lastAddedIndicator;

      for (var i = 0; i < $indicatorTypeSelect.val().length; i++) {
        if (!~Object.keys(appSettingsCache.indicators).indexOf($indicatorTypeSelect.val()[i])) {
          // set indicator name
          lastAddedIndicator = $indicatorTypeSelect.val()[i];
          break;
        }
      }

      var indexOption = $indicatorTypeSelect.find('[value="' + lastAddedIndicator + '"]').index();

      // unselect option
      $indicatorTypeSelect.find('[value="' + lastAddedIndicator + '"]').removeAttr('selected');
      // remove selected class
      $indicatorTypeSelect.prev('.dropdown-menu').find('li[data-original-index="' + indexOption + '"]').removeClass('selected');
    });

    // init selectpicker to all select in indicator settings modal
    $indicatorSettingsModal.on('show.bs.modal', function() {
      $indicatorForm.find('.select').selectpicker();
    });

    // reset all settings
    $resetBtn.on('click', function(e) {
      e.preventDefault();

      //set default theme
      $themeSelect.selectpicker('val', 'darkTurquoise');
      theme = 'darkTurquoise';

      app.removeChart();
      // reset saved settings
      appSettingsCache['indicators'] = {};
      appSettingsCache['chartType'] = 'line';

      // select series type
      $seriesTypeSelect.val('candlestick').selectpicker('refresh');
      // reset indicators select
      $indicatorTypeSelect.val('').selectpicker('refresh');
      // init, create chart
      app.createChart(chartContainer, true);
      //dismiss existing indicators
      indicatorlist = [];
    });

    $('#Showvolume').click(function() {
      if (chart.plot().getSeries("VolumeSeries")) {
        chart.plot().removeSeries("VolumeSeries");
        $('#Showvolume').html('Show volume');
      } else {
        createVolumeSeries(chart.plot(0)).data(mapping);
        $('#Showvolume').html('Hide volume');
      }

    });

    // event to add indicator
    $addIndicatorBtn.on('click', function() {
      var mapping = dataTable.mapAs({'value': 1, 'volume': 1, 'open': 1, 'high': 2, 'low': 3, 'close': 4});
      var indicator = indicatorsSettings.defaultSettings[indicatorsSettings.name];
      var settings = [mapping];
      var indicatorName = indicatorsSettings.name;

      // for slow/fast stochastic
      if (~indicatorName.toLowerCase().indexOf('stochastic')) {
        indicatorName = 'stochastic';
      }

      for (key in indicator) {
        if (key !== 'overview' && key !== 'plotIndex') {
          var val = $('#' + key).val();
          val = val === 'true' || val === 'false' ? val === 'true' : val;
          settings.push(val);
        }
      }

      // save settings for indicator
      appSettingsCache['indicators'][indicatorsSettings.name] = {};
      appSettingsCache['indicators'][indicatorsSettings.name]['settings'] = settings;
      appSettingsCache['indicators'][indicatorsSettings.name]['plotIndex'] = indicatorsSettings.plotIndex;

      var plot = chart.plot(indicatorsSettings.plotIndex);
      plot[indicatorName].apply(plot, settings);
      // adding extra Y axis to the right side
      plot.yAxis(1).orientation('right');
      // hide indicator settings modal
      $indicatorSettingsModal.modal('hide');

      //save indicator
      indicatorlist.push(appSettingsCache['indicators'][indicatorsSettings.name]);
    });

    $('select.choose-drawing-tools').on('change', changeAnnotations);
    $('select.choose-marker').on('change', changeAnnotations);
    $('[data-annotation-type]').on('click', changeAnnotations);


    $('#annotation-label-autosize').on('click', function() {
      var annotation = chart.annotations().getSelectedAnnotation();

      if (annotation && annotation.type === 'label') {
        annotation.width(null);
        annotation.height(null);
      }

      setToolbarButtonActive(null);

      $annotationLabel.focus();
    });

    function changeAnnotations() {
      var $that = $(this);

      setTimeout(function() {
        var $target = $that;
        var active = $target.hasClass('active');
        var $markerSize = $('#select-marker-size');
        var markerSize = $markerSize.val();
        // var fontSize = $fontSize.attr('data-volume');
        var $fontSize = $('#select-font-size');
        var fontSize = $fontSize.val();
        var fontColor = $('[data-color="fontColor"]').find('.color-fill-icon').css('background-color');

        var colorFill = $colorPickerFill.find('.color-fill-icon').css('background-color');
        var colorStroke = $colorPickerStroke.find('.color-fill-icon').css('background-color');

        var strokeType;
        var strokeWidth;
        var strokeDash;
        var STROKE_WIDTH = 1;

        if ($strokeSettings.val()) {
          switch ($strokeSettings.val()[0]) {
            case '6':
            case '7':
            case '8':
              strokeType = $strokeSettings.val()[0];
              strokeWidth = $strokeSettings.val()[1] || STROKE_WIDTH;
              break;
            default:
              strokeWidth = $strokeSettings.val()[0];
              strokeType = $strokeSettings.val()[1];
              break;
          }
        }

        switch (strokeType) {
          case '6':
            strokeDash = null;
            break;
          case '7':
            strokeDash = '1 1';
            break;
          case '8':
            strokeDash = '10 5';
            break;
        }

        var strokeSettings = {
          thickness: strokeWidth,
          color: colorStroke,
          dash: strokeDash
        };

        var fontSettings = normalizeFontSettings($fontSettings.val());

        document.body.addEventListener('keydown', escape, {once: true});

        function escape(e) {
          if (e.keyCode === 27) {
            chart.annotations().cancelDrawing();
            setToolbarButtonActive(null);
          }
        }

        if (active) {
          chart.annotations().cancelDrawing();
          setToolbarButtonActive(null);
        } else {
          var type = $target.data().annotationType || $target.find('option:selected').data().annotationType;

          if (!$target.data().annotationType) {
            var markerType = $target.find('option:selected').data().markerType;
          }

          setToolbarButtonActive(type, markerType);

          if (type) {

            if (!$target.data().annotationType) {
              var markerAnchor = $target.find('option:selected').data().markerAnchor;
            }

            var drawingSettings = {
              type: type,
              size: markerSize,
              color: annotationsColor,
              markerType: markerType,
              anchor: markerAnchor,
              fontSize: fontSize,
              fontColor: fontColor
            };

            $.extend(drawingSettings, fontSettings);

            if (type === 'label') {
              drawingSettings.anchor = fontSettings.anchor;

              drawingSettings.background = {
                fill: colorFill,
                stroke: strokeSettings
              };
              drawingSettings.hovered = {
                background: {
                  stroke: strokeSettings
                }
              };
              drawingSettings.selected = {
                background: {
                  stroke: strokeSettings
                }
              };
            } else {
              drawingSettings.fill = {};
              drawingSettings.fill.color = colorFill;
              drawingSettings.fill.opacity = 0.3;
              drawingSettings.stroke = strokeSettings;
              drawingSettings.hovered = {
                stroke: strokeSettings
              };
              drawingSettings.selected = {
                stroke: strokeSettings
              };
            }
            chart.annotations().startDrawing(drawingSettings);
          }
        }

        var annotation = chart.annotations().getSelectedAnnotation();

        if (annotation && annotation.fill === undefined && (!annotation.background || annotation.background().fill === undefined)) {
          $('.color-picker[data-color="fill"]').attr('disabled', 'disabled');
        } else {
          $('.color-picker[data-color="fill"]').removeAttr('disabled');
        }

        $target.val('');
      }, 1);
    }

    $('.btn[data-action-type]').click(function(evt) {
      var annotation = chart.annotations().getSelectedAnnotation();
      var $target = $(evt.currentTarget);
      $target.blur();
      var type = $target.attr('data-action-type');

      switch (type) {
        case 'removeAllAnnotations':
          removeAllAnnotation();
          break;
        case 'removeSelectedAnnotation':
          removeSelectedAnnotation();
          break;
        case 'unSelectedAnnotation':
          chart.annotations().unselect(annotation).cancelDrawing();
          setToolbarButtonActive(null);
          break;
        case 'showVolume':
          if (chart.plot().getSeries("VolumeSeries")) {
            chart.plot().removeSeries("VolumeSeries");
            $('#ShowVolume').html('Show volume');
          } else {
            createVolumeSeries(chart.plot(0)).data(mapping);
            $('#ShowVolume').html('Hide volume');
          }
          break;
        case 'saveAnno':
          var json;
          json = chart.plot(0).annotations().toJson(true);
          localStorage.setItem('annotationsList0', json);
          for (var key in appSettingsCache['indicators']) {
            var plotIndex = appSettingsCache['indicators'][key].plotIndex;
            json = chart.plot(plotIndex).annotations().toJson(true);
            localStorage.setItem('annotationsList' + plotIndex, json);
          }

          $('.btn[data-action-type]')['3'].className = 'btn btn-default disabled';
          break;
      }

    });

    $('#select-stroke-settings').on('change', function() {
      var strokeWidth;
      var strokeType;
      var STROKE_WIDTH = 1;

      if ($(this).val()) {
        switch ($(this).val()[0]) {
          case '6':
          case '7':
          case '8':
            strokeType = $(this).val()[0];
            strokeWidth = $(this).val()[1] || STROKE_WIDTH;
            break;
          default:
            strokeType = $(this).val()[1];
            strokeWidth = $(this).val()[0];
            break;
        }
        updatePropertiesBySelectedAnnotation(strokeWidth, strokeType);
      }
    });

    $('#select-marker-size').on('change', function() {
      var annotation = chart.annotations().getSelectedAnnotation();

      if (annotation === null) return;

      if (annotation.type === 'marker') {
        annotation.size($(this).val());
      }
    });


    $('#select-font-size').on('change', function() {
      var annotation = chart.annotations().getSelectedAnnotation();

      if (annotation === null) return;

      if (annotation.type === 'label') {
        annotation.fontSize($(this).val());
      }
    });


    $fontSettings.on('change', function() {
      var annotation = chart.annotations().getSelectedAnnotation();

      if (annotation && annotation.type === 'label') {

        var fontSettings = normalizeFontSettings($(this).val());

        $labelMethod.each(function() {
          var method = $(this).data().labelMethod;

          annotation[method](fontSettings[method]);
        });

        $annotationLabel.focus();
      }
    });

    $('html').keyup(function(e) {
      if (e.keyCode === 93 || e.keyCode === 46) {
        removeSelectedAnnotation();
      }
    });
  });

  function initHeightChart() {
    var creditsHeight = 10;
    var drawingToolsPanelHeight = $('#drawingToolsPanel').outerHeight();
    $('#chart-container').height($(window).height() - $indicatorNavPanel.outerHeight() - creditsHeight - drawingToolsPanelHeight);
  }

  function createChart(container, updateChart) {

    // apply theme
    anychart.theme(theme);

    // create and tune the chart
    chart = anychart.stock();
    var plot = chart.plot();
    plot.legend(false);
    chart.title('BTC/USD data for the last 120 minutes and realtime ticker\nThe last update was:');

    //create OHLC series
    var series = plot.candlestick();

    series.name('BTC/USD');

    series.legendItem({
      iconEnabled: false
    });

    var volumeSeries = createVolumeSeries(plot);

    //render the chart
    chart.container(container).draw();

    $('#Showvolume').html('Hide volume');

    // create range selector
    var rangeSelector = anychart.ui.rangeSelector();
    // init range selector
    rangeSelector.render(chart);
    // Set custom ranges for range selector.
    rangeSelector.ranges([
      {type: "max", text: "MAX"},
      {type: "unit", unit: "Hour", count: 2, text: "2h", anchor: "last-date"},
      {type: "unit", unit: "Hour", count: 1, text: "1h", anchor: "last-date"},
      {type: "unit", unit: "Minute", count: 30, text: "30m", anchor: "last-date"},
      {type: "unit", unit: "Minute", count: 10, text: "10m", anchor: "last-date"}
    ]);

    //get saved annotations from the 0 plot
    var ChartStore = localStorage.getItem('annotationsList0');
    chart.plot().annotations().fromJson(ChartStore);
    // add annotation items in context menu
    chart.contextMenu().itemsFormatter(contextMenuItemsFormatter);

    // use annotation events to update application UI elements
    chart.listen('annotationDrawingFinish', onAnnotationDrawingFinish);
    chart.listen('annotationSelect', onAnnotationSelect);
    chart.listen('annotationUnSelect', function() {
      $('.color-picker[data-color="fill"]').removeAttr('disabled');
      $('.select-marker-size').removeAttr('disabled');
      $('.drawing-tools-solo').find('.bootstrap-select').each(function() {
        $(this).removeClass('open');
      })
    });
    chart.listen('annotationChangeFinish', function() {
      $('.btn[data-action-type]')['3'].className = 'btn btn-default';
    });

    // add textarea for label annotation and listen events
    chart.listen('annotationDrawingFinish', function(e) {
      if (e.annotation.type === 'label') {
        $annotationLabel.val(e.annotation.text())
          .focus()
          .on('change keyup paste', function(e) {
            if (e.keyCode === 46) return;
            try {
              var annotation = chart.annotations().getSelectedAnnotation();
              annotation.enabled();
            } catch (err) {
              annotation = null;
            }
            try {
              if (annotation) {
                $(this).val() ? annotation.text($(this).val()) : annotation.text(' ') && $(this).val(' ');
              }
            } catch {
              return;
            }
          });

        chart.listen('annotationDrawingFinish', function(e) {
          if (e.annotation.type === 'label') {
            $annotationLabel.val(e.annotation.text())
              .focus();
          }
        });

        chart.listen('annotationSelect', function(e) {
          if (e.annotation.type === 'label') {
            $annotationLabel.val(e.annotation.text())
              .focus();
          }
        });

        chart.listen('annotationUnselect', function() {
          if (e.annotation.type === 'label') {
            $annotationLabel.val('');
          }
        });
      }
    });

    //data loaded event
    chart.listen('dataChanged', function() {
      var ChartStore = localStorage.getItem('annotationsList0');
      chart.plot(0).annotations().fromJson(ChartStore);
    });

    if (updateChart) {
      var currentRange = JSON.parse(localStorage.getItem('currentRange'));
      if (currentRange) {
        setTimeout(function() {
          chart.selectRange(currentRange.min, currentRange.max, true);
        }, 10);
      }

      //restore data from existing datatable
      mapping = dataTable.mapAs({
        x: 0,
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        value: {
          column: 5
        }
      });

      //set mapping to both series
      series.data(mapping);
      volumeSeries.data(mapping);

      var indicatorName;
      var indicatorPlot;
      var indicatorSettings = [];

      plot.yScale('linear');
      for (var keyIndicator in appSettingsCache['indicators']) {
        indicatorName = keyIndicator;

        if (appSettingsCache['indicators'].hasOwnProperty(keyIndicator)) {
          indicatorSettings = appSettingsCache['indicators'][keyIndicator]['settings'];
          indicatorSettings[0] = dataTable.mapAs({'value': 1, 'volume': 1, 'open': 1, 'high': 2, 'low': 3, 'close': 4});
        }

        // for slow/fast stochastic
        if (~indicatorName.toLowerCase().indexOf('stochastic')) {
          indicatorName = 'stochastic';
        }

        if (appSettingsCache['indicators'].hasOwnProperty(keyIndicator)) {
          indicatorPlot = chart.plot(appSettingsCache['indicators'][keyIndicator]['plotIndex']);
          indicatorPlot[indicatorName].apply(indicatorPlot, indicatorSettings);
          // adding extra Y axis to the right side
          indicatorPlot.yAxis(1).orientation('right');
        }
      }

      var arr = [];
      for (var key in appSettingsCache.indicators) {
        arr.push(key);
      }
      $indicatorTypeSelect.val(arr).selectpicker('refresh');

      ChartStore = localStorage.getItem('annotationsList0');
      if (JSON.parse(ChartStore).annotationsList.length)
        chart.plot(0).annotations().fromJson(ChartStore);
      for (var key in appSettingsCache['indicators']) {
        var plotIndex = appSettingsCache['indicators'][key].plotIndex;
        ChartStore = localStorage.getItem('annotationsList' + plotIndex);
        if (JSON.parse(ChartStore).annotationsList.length)
          chart.plot(plotIndex).annotations().fromJson(ChartStore);
      }


      return;
    }

    dataTable = anychart.data.table();

    // creates an Application to work with socket
    //start COMET connection
    if (!updateChart) {
      localStorage.removeItem('currentRange');
      (function() {
        //open connection
        $.get('http://localhost:8081/cexIO');

        start();

        function start() {

          if (!window.EventSource) {
            alert('This browser doesn\'t support EventSource.');
            return;
          }

          var eventSource = new EventSource('cexIO');

          eventSource.onopen = function() {
            log("Connection established");
          };

          eventSource.onerror = function(e) {
            if (this.readyState == EventSource.CONNECTING) {
              log("Connection lost, retrying...");
            } else {
              log("Error, state: " + this.readyState);
            }
          };

          eventSource.addEventListener('bye', function(e) {
            log("Bye: " + e.data);
          }, false);

          eventSource.onmessage = function(e) {
            timer = 0;
            var data = JSON.parse(e.data);
            log(e.data);
            //  BTC/USD current price ticker
            if (data.e === 'tick' && data.data.symbol1 === 'BTC' && data.data.symbol2 === 'USD') {
              priceTickDataHandler(data);
            }

            // data for the last 120 minutes
            if (data.e === 'init-ohlcv-data' && data.pair === 'BTC:USD') {
              historyDataHandler(data);
            }

            //  BTC/USD 1 minute changes subscription
            if (data.e === 'ohlcv1m' && data.data.pair === 'BTC:USD') {
              oneMinuteDataHandler(data);
            }
          };
        }

        function log(msg) {
          // console.log(msg + '\n');
        }
      })();
    }

    chart.listen('chartDraw', function() {
      initHeightChart();
      setTimeout(function() {
        $loader.hide();
      }, 100);
      //launch timer
      if (secondCounter == null) {
        secondCounter = setInterval(function() {
          timer += 1;
          chart.title('BTC/USD data for the last 120 minutes and realtime ticker\nThe last update was: ' + timer + ' seconds ago');
        }, 1000);
      }


      var $body = $('body');
      var $textArea = '<textarea id="annotation-label"></textarea>';

      if (!$body.find('#annotation-label').length) {
        $body.find('[data-annotation-type="label"]').length ?
          $body.find('[data-annotation-type="label"]').after($textArea) :
          $body.append($textArea);
        $annotationLabel = $('#annotation-label');
      }
    });

    function priceTickDataHandler(data) {
      var price = data.data.price;
      //create empty array for point data update
      var priceTickData = [];
      priceTickData[0] = new Array(5);

      //select the last point from existing datatable
      var selectable = mapping.createSelectable();
      selectable.selectAll();
      var iterator = selectable.getIterator();

      while (iterator.advance()) {
        //put data from the last exsiting point
        priceTickData[0][0] = iterator.get('x');
        priceTickData[0][1] = iterator.get('open');
        priceTickData[0][2] = iterator.get('high');
        priceTickData[0][3] = iterator.get('low');
        priceTickData[0][5] = iterator.get('value');
      }

      priceTickData[0][4] = price;
      //update min and max
      if (priceTickData[0][2] < price) {
        priceTickData[0][2] = price;
      } else if (priceTickData[0][3] > price) {
        priceTickData[0][3] = price;
      }

      //set ipdated data row to datatable
      dataTable.addData(priceTickData);
    }

    function historyDataHandler(data) {
      //helper to format timestamp from vendor
      //vendor uses seconds from 1.01.1970 for timestamp
      var tempData = data.data;
      tempData.forEach(function(row) {
        row[0] *= 1000;
      });
      // add new data
      dataTable.addData(tempData);
      // map the data
      mapping = dataTable.mapAs({
        x: 0,
        open: 1,
        high: 2,
        low: 3,
        close: 4,
        value: {
          column: 5
        }
      });

      //set mapping to both series
      series.data(mapping);
      volumeSeries.data(mapping);
    }

    function oneMinuteDataHandler(data) {
      /* due to different data format provided
              by vendor for different subscriptions
               data needs to be formatted to any default view  */
      var oneMinData = [];
      oneMinData[0] = new Array(5);
      oneMinData[0][0] = data.data.time * 1000;
      oneMinData[0][1] = data.data.o;
      oneMinData[0][2] = data.data.h;
      oneMinData[0][3] = data.data.l;
      oneMinData[0][4] = data.data.c;
      oneMinData[0][5] = data.data.v;
      //add formatted data to OHLCV chart
      dataTable.addData(oneMinData);
    }

  }

  function createVolumeSeries(plot) {

    //create volume series
    var volumeSeries = plot.column().name('Volume');
    volumeSeries.id("VolumeSeries");
    volumeSeries.zIndex(100)
      .maxHeight('25%')
      .bottom(0);
    volumeSeries.legendItem({
      textOverflow: '',
      iconEnabled: false
    });

    var customScale = anychart.scales.log();
    // sets y-scale
    volumeSeries.yScale(customScale);

    return volumeSeries;
  }

  function removeChart() {
    if (chart) {
      chart.dispose();
      //nulling mappings
      mapping = null;
    }
  }

  function createPageColorPicker() {
    var colorPicker = $('.color-picker');
    var strokeWidth;
    var STROKE_WIDTH = 1;
    colorPicker.colorpickerplus();
    colorPicker.on('changeColor', function(e, color) {
      var annotation = chart.annotations().getSelectedAnnotation();
      var _annotation = annotation;

      if (annotation) {
        if (annotation.type === 'label') {
          $annotationLabel.focus();
          annotation = annotation.background();
        }

        switch ($(this).data('color')) {
          case 'fill':
            annotation.fill(color, 0.3);
            break;
          case 'stroke':
            strokeWidth = annotation.stroke().thickness || STROKE_WIDTH;
            strokeDash = annotation.stroke().dash || '';
            var settings = {
              thickness: strokeWidth,
              color: color,
              dash: strokeDash
            };
            setAnnotationStrokeSettings(annotation, settings);
            break;
          case 'fontColor':
            if (_annotation.type === 'label') _annotation.fontColor(color);
            break;
        }
      }

      if (color === null) {
        $('.color-fill-icon', $(this)).addClass('colorpicker-color');
      } else {
        $('.color-fill-icon', $(this)).removeClass('colorpicker-color');
        $('.color-fill-icon', $(this)).css('background-color', color);
      }
    });
  }

  function removeSelectedAnnotation() {
    var annotation = chart.annotations().getSelectedAnnotation();
    if (annotation) chart.annotations().removeAnnotation(annotation);
    return !!annotation;
  }

  function removeAllAnnotation() {
    chart.annotations().removeAllAnnotations();
    localStorage.removeItem("annotationsList");
  }

  function onAnnotationDrawingFinish() {
    setToolbarButtonActive(null);
    $('.btn[data-action-type]')['3'].className = 'btn btn-default';
  }

  function onAnnotationSelect(evt) {
    var annotation = evt.annotation;
    var colorFill;
    var colorStroke;
    var strokeWidth;
    var strokeDash;
    var strokeType;
    var markerSize;
    var fontColor;
    var fontSize;
    var STROKE_WIDTH = 1;
    // val 6 in select = 'solid'
    var STROKE_TYPE = '6';
    var $strokeSettings = $('#select-stroke-settings');
    var $markerSize = $('#select-marker-size');
    var $markerSizeBtn = $('.select-marker-size');
    var $colorPickerFill = $('.color-picker[data-color="fill"]');
    var $colorPickerStroke = $('.color-picker[data-color="stroke"]');
    var $colorPickerFontColor = $('.color-picker[data-color="fontColor"]');

    var fontSettings = [];

    if (annotation.type === 'label') {
      $annotationLabel.focus();

      fontSize = annotation.fontSize();

      $fontSize.attr('data-volume', fontSize);

      fontColor = annotation.fontColor();

      fontSettings = [];

      $labelMethod.each(function() {
        var method = $(this).data().labelMethod;

        fontSettings.push(annotation[method]());
      });

      // update font settings select
      $fontSettings.val(fontSettings).selectpicker('refresh');

      annotation = annotation.background();
    }
    if (annotation.fill !== undefined) {
      $colorPickerFill.removeAttr('disabled');
      colorFill = annotation.fill();
    } else {
      $colorPickerFill.attr('disabled', 'disabled');
    }

    if (typeof annotation.stroke() === 'function') {
      colorStroke = $colorPickerStroke.find('.color-fill-icon').css('background-color');
      colorFill = $colorPickerFill.find('.color-fill-icon').css('background-color');

      if (colorFill.indexOf('a') === -1) {
        colorFill = colorFill.replace('rgb', 'rgba').replace(')', ', 0.3)');
      }
      if ($strokeSettings.val()) {
        switch ($strokeSettings.val()[0]) {
          case '6':
          case '7':
          case '8':
            strokeType = $strokeSettings.val()[0];
            strokeWidth = $strokeSettings.val()[1] || STROKE_WIDTH;
            break;
          default:
            strokeWidth = $strokeSettings.val()[0];
            strokeType = $strokeSettings.val()[1];
            break;
        }
      } else {
        strokeWidth = STROKE_WIDTH;
        strokeType = STROKE_TYPE;
      }

    } else {
      colorStroke = annotation.stroke().color;
      strokeWidth = annotation.stroke().thickness;
      strokeDash = annotation.stroke().dash;
    }

    switch (strokeType) {
      case '6':
        strokeType = null;
        break;
      case '7':
        strokeType = '1 1';
        break;
      case '8':
        strokeType = '10 5';
        break;
    }

    if (strokeType === undefined) {
      strokeType = strokeDash;
    }

    if (annotation.type === 'marker') {
      markerSize = annotation.size();

      if ($('.choose-marker').hasClass('open')) {
        $markerSize.val($markerSize.val()).selectpicker('refresh');
        annotation.size($markerSize.val());
        $markerSizeBtn.removeAttr('disabled')
      } else {
        $markerSize.removeAttr('disabled').val(markerSize).selectpicker('refresh');
        annotation.size(markerSize);
        $markerSizeBtn.removeAttr('disabled')
      }
      $markerSizeBtn.removeAttr('disabled');

    } else {
      $markerSizeBtn.attr('disabled', 'disabled');
    }

    var settings = {
      thickness: strokeWidth,
      color: colorStroke,
      dash: strokeType
    };

    setAnnotationStrokeSettings(annotation, settings);

    if (annotation.fill !== undefined) {
      annotation.fill(colorFill);
    }

    switch (strokeType) {
      case '1 1':
        strokeDash = 7;
        break;
      case '10 5':
        strokeDash = 8;
        break;
      default:
        strokeDash = 6;
        break;
    }

    $colorPickerFill.find('.color-fill-icon').css('background-color', colorFill);
    $colorPickerStroke.find('.color-fill-icon').css('background-color', colorStroke);
    $colorPickerFontColor.find('.color-fill-icon').css('background-color', fontColor);
    $strokeSettings.val([strokeWidth, strokeDash]).selectpicker('refresh');
  }

  function contextMenuItemsFormatter(items) {
    // insert context menu item on 0 position
    items['annotations-remove-selected'] = {
      text: "Remove selected annotation",
      action: removeSelectedAnnotation,
      index: -10
    };

    // insert context menu item on 1 position
    items['annotations-remove-all'] = {
      text: "Remove all annotations",
      action: removeAllAnnotation,
      index: -5
    };

    // insert context menu separator
    items['annotations-separator'] = {
      index: -4
    };

    return items;
  }

  function setToolbarButtonActive(type, markerType) {
    var $buttons = $('.btn[data-annotation-type]');
    $buttons.removeClass('active');
    $buttons.blur();

    if (type) {
      var selector = '.btn[data-annotation-type="' + type + '"]';
      if (markerType) selector += '[data-marker-type="' + markerType + '"]';
      $(selector).addClass('active');
    }
  }

  function updatePropertiesBySelectedAnnotation(strokeWidth, strokeType) {
    var strokeColor;
    var annotation = chart.annotations().getSelectedAnnotation();
    if (annotation === null) return;

    if (typeof annotation.stroke === 'function') {
      strokeColor = annotation.color();
    } else if (annotation.type === 'label') {
      strokeColor = annotation.background().stroke().color;
    } else {
      strokeColor = annotation.stroke().color;
    }

    switch (strokeType) {
      case '6':
        strokeType = null;
        break;
      case '7':
        strokeType = '1 1';
        break;
      case '8':
        strokeType = '10 5';
        break;
    }

    var settings = {
      thickness: strokeWidth,
      color: strokeColor,
      dash: strokeType
    };

    if (annotation.type === 'label') {
      $annotationLabel.focus();
      // annotation = annotation.background();
      annotation.background().stroke(settings);
      annotation.hovered().background().stroke(settings);
      annotation.selected().background().stroke(settings);
      return;
    }

    setAnnotationStrokeSettings(annotation, settings);
  }


  function setAnnotationStrokeSettings(annotation, settings) {
    annotation.stroke(settings);
    if (annotation.hovered || annotation.selected) {
      annotation.hovered().stroke(settings);
      annotation.selected().stroke(settings);
    }
  }

  function initTooltip(position) {
    $(document).ready(function() {
      $('[data-toggle="tooltip"]').tooltip({
        'placement': position,
        'animation': false
      });
    });
  }

  function normalizeFontSettings(val) {
    var fontMethods = {};

    $labelMethod.each(function() {
      fontMethods[$(this).data().labelMethod] = null;
    });

    val && val.forEach(function(item) {
      if (item) {
        $fontSettings.find('[data-label-method]').each(function() {
          var $that = $(this);
          var $el = $(this).find('option').length ? $(this).find('option') : $(this);

          $el.each(function() {
            if ($(this).val() === item) {
              fontMethods[$that.attr('data-label-method')] = item;
            }
          });
        });
      }
    });

    return fontMethods
  }

  function createHtmlToIndicatorForm() {
    var $indicatorFormGroup;
    var indicatorSettings = indicatorsSettings.defaultSettings[indicatorsSettings.name];
    var $option;
    var i = 0;

    $('#indicatorSettingsModalTitle').text(indicatorsSettings.defaultSettings[indicatorsSettings.name].overview.title);

    // empty form
    $indicatorForm.empty();
    // create row
    $indicatorForm.append('<div class="row"></div>');
    var $indicatorFormRow = $indicatorForm.find('.row');

    for (var key in indicatorSettings) {
      if (indicatorSettings.hasOwnProperty(key) && key !== 'overview' && key !== 'plotIndex') {

        if (typeof indicatorSettings[key] === 'string') {
          $indicatorFormRow.append(selectHtml);
          $indicatorFormGroup = $('#indicatorFormGroup');
          $indicatorFormGroup.find('select').attr('id', key);
          $indicatorFormGroup.find('label').attr('for', key).text(getInputLabelText(key));

          for (i = 0; i < indicatorsSettings.seriesType.length; i++) {
            $option = $('<option></option>');
            $option.val(indicatorsSettings.seriesType[i].toLowerCase());
            $option.text(getInputLabelText(indicatorsSettings.seriesType[i]));
            $indicatorFormGroup.find('select').append($option);
          }

          $indicatorFormGroup.removeAttr('id');

        } else if (typeof indicatorSettings[key] === 'number') {
          $indicatorFormRow.append(inputHtml);
          $indicatorFormGroup = $('#indicatorFormGroup');
          $indicatorFormGroup.find('input').attr('id', key);

          $indicatorFormGroup.removeAttr('id').find('label').attr('for', key).text(getInputLabelText(key));

        } else if (typeof indicatorSettings[key] === 'object') {
          $indicatorFormRow.append(selectHtml);
          $indicatorFormGroup = $('#indicatorFormGroup');
          $indicatorFormGroup.find('select').attr('id', key);
          $indicatorFormGroup.find('label').attr('for', key).text(getInputLabelText(key));

          for (i = 0; i < indicatorSettings[key].length; i++) {
            $option = $('<option></option>');
            $option.val(indicatorSettings[key][i].toLowerCase());
            $option.text(indicatorSettings[key][i]);
            $indicatorFormGroup.find('select').append($option);
          }

          $indicatorFormGroup.removeAttr('id');
        }
      }
    }

    // col class to form el
    setColClass($indicatorForm);
    // indicator overview text
    if ($indicatorForm.find($("[class*='col-sm-']")).length == 0) {
      $indicatorForm.find($('[class="row"]')).append('<div class="col-xs-12" id="overviewText"></div>');
    } else {
      $indicatorForm.find($("[class*='col-sm-']")).last().after('<div class="col-xs-12" id="overviewText"></div>');
    }
    $indicatorForm.find('#overviewText').append(indicatorsSettings.defaultSettings[indicatorsSettings.name].overview.description);
  }

  function setDefaultIndicatorSettings() {

    var indicatorSettings = indicatorsSettings.defaultSettings[indicatorsSettings.name];

    for (var key in indicatorSettings) {
      if (indicatorSettings.hasOwnProperty(key) && key !== 'overview' && key !== 'plotIndex') {
        $('#' + key).val(indicatorSettings[key]);
      }
    }
  }
})();