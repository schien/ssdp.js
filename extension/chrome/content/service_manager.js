(function(exports) {
  var DEBUG = false;
  'use strict';

  var savedServices = {};

  var debugEl;
  var audioPlayer;
  var videoPlayer;
  var imagePlayer;
  var discoverButton;
  var currentPlayer;
  var playerToggler;
  var folderList;

  function debugLog(msg, level) {
    if (!DEBUG && level == 'debug') {
      return;
    }
    var logEl = document.createElement('div');
    logEl.textContent = msg;
    debugEl.appendChild(logEl);
  }

  function toggleFolder(evt) {
    evt.preventDefault();
    var elem = evt.target;

    if (elem.nextSibling && elem.nextSibling.tagName == 'DIV') {
      // folder is opened. Close it.
      elem.parentElement.removeChild(elem.nextSibling);
      elem.classList.remove('opened');
    } else {
      // folder is closed. Open it.
      debugLog(elem.serviceId, 'debug');
      elem.classList.add('opened');
      browseFolder(
        elem.dataset.serviceId, elem.hash.substr(1), evt.target);
    }
  }

  function togglePlayer(value) {
    if (typeof value != 'boolean') {
      value = currentPlayer.classList.contains('hide');
    }
    audioPlayer.classList.add('hide');
    videoPlayer.classList.add('hide');
    imagePlayer.classList.add('hide');
    if (value) {
      currentPlayer.classList.remove('hide');
    }
  }

  function switchPlayer(type) {
    if (type == 'audio') {
      currentPlayer = audioPlayer;
    } else if (type == 'video') {
      currentPlayer = videoPlayer;
    } else if (type == 'image') {
      currentPlayer = imagePlayer;
    }
    togglePlayer(true);
  }

  function playFile(evt) {
    evt.preventDefault();
    var fileType = evt.target.dataset.mime.split('/')[0].toLowerCase();
    var fileFormat = evt.target.dataset.mime.split('/')[1].toLowerCase();
//    if (fileFormat == 'mpeg' || fileFormat == 'mp4') {
//      window.open(evt.target.href, 'mpegPopup');
//      return;
//    }

    if (evt.target.href.substr(-3) == 'ogv') {
      fileFormat = 'video/ogg';
    } else if (evt.target.href.substr(-3) == 'ogg') {
      fileFormat = 'audio/ogg';
    }
    switchPlayer(fileType);

    currentPlayer.hidden = false;
    currentPlayer.src = evt.target.href;
    currentPlayer.setAttribute('type', fileFormat);
    currentPlayer.oncanplay = function() {
      this.play();
    };
  }

  function browseFolder(serviceId, folderId, folderElement) {
    var mediaServer = savedServices[serviceId];
    if (!mediaServer) {
      return;
    }

    folderId = folderId || '';

    mediaServer.browse(folderId).then(function(response) {
      if (!response || !response.data) {
        return;
      }


      var data = response.data.Result;
      if (data.indexOf('xmlns:dlna') == -1) {
        data = data.replace('<DIDL-Lite ',
          '<DIDL-Lite xmlns:dlna="urn:schemas-dlna-org:device-1-0" ');
      }
      var parser = new DOMParser();
      var serializer = new XMLSerializer();
      var xmlResponse = parser.parseFromString(data, 'application/xml');
      var lists = xmlResponse.documentElement.children;

      var sublist = document.createElement('div');
      sublist.className = 'sublist';

      for (var i = 0; i < lists.length; i++) {
        var item = lists[i];

        var titleElem = item.getElementsByTagName('dc:title')[0];
        var title;
        if (titleElem) {
          title = titleElem.textContent;
        }

        var newElem;
        if (item.tagName == 'container') {
          newElem = document.createElement('a');

          newElem.dataset.serviceId = serviceId;
          newElem.addEventListener('click', toggleFolder);
          newElem.href = '#' + item.getAttribute('id');
          newElem.textContent = title;
          newElem.className = 'folder';

          sublist.appendChild(newElem);
        } else if (item.tagName == 'item') {
          var linkElem = item.getElementsByTagName('res')[0];
          var link, mime;
          if (linkElem) {
            link = linkElem.textContent;
            mime = linkElem.getAttribute('protocolInfo').split(':')[2];
          }
          newElem = document.createElement('a');
          newElem.addEventListener('click', playFile);
          newElem.dataset.mime = mime;
          newElem.href = link;
          newElem.textContent = title;
          newElem.className = mime.split('/')[0];
          sublist.appendChild(newElem);
        }
      }
      if (!folderElement) {
        folderList.appendChild(sublist);
      } else {
        folderElement.parentElement.
            insertBefore(sublist, folderElement.nextSibling);
      }

      debugLog(serializer.serializeToString(xmlResponse), 'debug');
    });
  }

  function processService(service, i) {
      service._index = i;
      if (savedServices[service.id]) {
        return;
      }

      var mediaServer =
        new Plug.UPnP_ContentDirectory(service, { debug: false });
      if (!savedServices[service.id]) {
        savedServices[service.id] = mediaServer;
      }

      mediaServer.getSystemUpdateId().then(function(response) {
        if (response && response.data) {
          debugLog('Service[' + service._index + '] is reporting UpdateId=[' +
            response.data.Id + ']');
        } else {
          debugLog('Service[' + service._index + '] is reporting no response');
        }

      }).then(null, function(error) { // Handle any errors

        debugLog('An error occurred: ' + error.description);

      });

      var serverElem = document.createElement('div');
      serverElem.className = 'server';

      var parser = new DOMParser();
      var configDocument = parser.parseFromString(mediaServer.svc.config, 'text/xml');
      serverElem.textContent = configDocument.getElementsByTagName('friendlyName')[0].textContent;
      folderList.appendChild(serverElem);

      browseFolder(service.id, null, serverElem);

  
  }

  function onServices(services) {

    var idx = services.length;
    services.addEventListener('servicefound', function _servicefound(e) {
      processService(services[idx], idx);
      idx++;
    });

    debugLog(services.length + ' service' +
    (services.length !== 1 ? 's' : '') +
    ' found in the current network');

    if (services.length === 0) {
      return;
    }

    for (var i = 0; i < services.length; i++) {
      var service = services[i];
      processService(service, i);
    }
  }

  function discover() {
    if (navigator.getNetworkServices) {
      debugLog('Searching for UPnP services in the current network...');
      navigator.getNetworkServices('upnp:urn:schemas-upnp-org:service:ContentDirectory:1')
      .then(onServices, function(e) {
          debugLog('An error occurred obtaining UPnP Services [CODE: ' +
                    error.code + ']');
      });
    } else {
      debugLog(
          'navigator.getNetworkServices API is not supported in this browser');
    }
  }

  function init() {
    var audioToggler = document.getElementById('audioToggler');
    var videoToggler = document.getElementById('videoToggler');
    var imageToggler = document.getElementById('imageToggler');
    folderList = document.getElementById('folderList');
    debugEl = document.getElementById('debug');
    audioPlayer = document.getElementById('audioPlayer');
    videoPlayer = document.getElementById('videoPlayer');
    imagePlayer = document.getElementById('imagePlayer');
    playerToggler = document.getElementById('playerToggler');
    discoverButton = document.getElementById('discoverButton');

    currentPlayer = imagePlayer;
    togglePlayer(false);

    playerToggler.addEventListener('click', togglePlayer);
    audioToggler.addEventListener('click', switchPlayer.bind(null, 'audio'));
    videoToggler.addEventListener('click', switchPlayer.bind(null, 'video'));
    imageToggler.addEventListener('click', switchPlayer.bind(null, 'image'));
    discoverButton.addEventListener('click', discover);

    discover();
  }

  window.addEventListener('load', function() {
    init();
  });

  exports.ServiceManager = {
    savedServices: savedServices
  };
})(window);
