/**
 *  stores the videoTrackNumber and returns the start of first cluster
 */
function parseInitSegment(dataView) {
  parser = new shaka.util.EbmlParser(dataView);
  headElement = parser.parseElement();
  segmentElement = parser.parseElement();
  segmentParser = segmentElement.createParser();
  segmentParser.parseElement(); // Segment Information
  tracksElement = segmentParser.parseElement();
  parseTracks(tracksElement);
  console.log("Video track number = " + _videoTrackNumber);
  _parsedInitSegment = true;

  clusterElement = segmentParser.parseElement();
  clusterStart = clusterElement.getDataView().byteOffset - 12;
  return new Uint8Array(dataView.buffer, clusterStart);
}

/**
 * returns remaining data
 */
function parseCluster(clusterElement) {
  var videoFrames = 0;
  var latestTs;
  try {
    clusterParser = clusterElement.createParser();
    clusterParser.parseElement(); // timecode id
    while (clusterParser.hasMoreData()) {
      element = clusterParser.parseElement();
      if (element.id === SIMPLE_BLOCK_ID) {
        const dv = element.getDataView();
        const trackNumber = dv.getUint8(0);
        const relativeTimestamp = dv.getUint16(1);
        latestTs = relativeTimestamp;
        if ((trackNumber & _videoTrackNumber) === _videoTrackNumber) {
          videoFrames++;
        }
      }
      if (element.id === CLUSTER_ID) {
        // compute framerate based on frames in the cluster so far
        var framerate = (videoFrames - 1) / (latestTs / 1000);
        document.getElementById("framerate").innerHTML =
          parseInt(framerate * 10) / 10;
        console.log("framerate: " + framerate);
        // At this point we've reached one whole cluster, so remove this from _unparsedData
        nextClusterStart = element.getDataView().byteOffset - 12;
        _unparsedData = new Uint8Array(
          element.getDataView().buffer,
          nextClusterStart
        );
        parseCluster(element);
      }
    }
  } catch (e) {
    // errors are expected if we try to parse a partial cluster, just ignore it
  }
}

function parseTracks(tracksElement) {
  tracksParser = tracksElement.createParser();
  while (tracksParser.hasMoreData()) {
    parseTrack(tracksParser.parseElement());
  }
}

// finds the video track and stores the track number so we can later
// use it so we can determine video framerate
function parseTrack(trackElement) {
  parser = trackElement.createParser();
  var trackNumber;
  var trackType;
  while (parser.hasMoreData()) {
    element = parser.parseElement();
    switch (element.id) {
      case 0xd7: // track number
        trackNumber = element.getUint();
      case 0x83: // track type
        trackType = element.getUint();
    }
  }
  // set video track number when we find it
  if (trackType == 1) {
    _videoTrackNumber = trackNumber;
  }
}
