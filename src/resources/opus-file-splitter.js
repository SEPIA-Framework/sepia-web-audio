//MIT License - original: https://github.com/AnthumChris/fetch-stream-audio/tree/master/utils/opus-file-splitter

class OggPageHeader {

  constructor (view, offset) {
    this.view = view;
    this.offset = offset;
    this.isIdPage = false;
    this.isCommentPage = false;
    this.isAudioPage = false;
    this.pageSegments = view.getUint8(offset + 26);
    this.headerSize = 27 + this.pageSegments;

    // add sum of lacing values to get total page size
    this.pageSize = 0;
    const lacingValues = [];
    for (let i=0; i < this.pageSegments; i++) {
      this.pageSize+= view.getUint8(offset + 27 + i)
    }

    this.version = view.getUint8(offset + 4);
    this.type = {
      continuedPage: view.getUint8(offset + 5, true) & 1 << 0,
      firstPage:     view.getUint8(offset + 5, true) & 1 << 1,
      lastPage:      view.getUint8(offset + 5, true) & 1 << 2,
    };
    this.serial = view.getUint32(offset + 14, true).toString(16);
    this.checksum = view.getUint32(offset + 22, true).toString(16);
  }

  get granulePosition() {
    return this.view.getBigInt64(this.offset + 6, true);
  }
  set granulePosition(value) {
    this.view.setBigInt64(this.offset + 6, value, true);
  }


  get pageSequence() {
    return this.view.getInt32(this.offset + 18, true);
  }
  set pageSequence(value) {
    this.view.setInt32(this.offset + 18, value, true);
  }

  get isFirstPage() {
    return this.type.firstPage != 0;
  }
  set isFirstPage(truthy) {
    // set first bit
    let bit = this.view.getUint8(this.offset+5)
    if (truthy)
      bit |= 1 << 1
    else
      bit &= ~(1 << 1)
    this.view.setUint8(this.offset+5, bit);
    this.type.firstPage = this.view.getUint8(this.offset + 5, true) & 1 << 1;
  }

  get isLastPage() {
    return this.type.lastPage != 0;
  }
  set isLastPage(truthy) {
    // set third bit
    let bit = this.view.getUint8(this.offset+5)
    if (truthy)
      bit |= 1 << 2
    else
      bit &= ~(1 << 2)
    this.view.setUint8(this.offset+5, bit);
    this.type.lastPage = this.view.getUint8(this.offset + 5, true) & 1 << 2;
  }
}

class OpusFileSplitter {

  constructor(buffer) {
    this.parseFile(buffer)
  }

  get audioPageBoundaries() {
    return this.audioPageBoundaries;
  }

  // scans file and executes callback when a page is found. ({ pageHeader }) => 
  scanPages(buffer, cb) {
    // big-endian Ogg page markers. see https://tools.ietf.org/html/rfc3533#page-10
    const pageMarker = new DataView((new TextEncoder().encode('OggS')).buffer).getUint32();
    const opusIdHeaderMarker = new DataView(new TextEncoder().encode('OpusHead').buffer).getBigUint64();
    const opusCommentHeaderMarker = new DataView(new TextEncoder().encode('OpusTags').buffer).getBigUint64();

    const view = new DataView(buffer);
    const scanTo = buffer.byteLength-Uint32Array.BYTES_PER_ELEMENT;

    let idPageFound = false;
    let commentPageFound = false;

    for (let i=0; i<scanTo; i++) {
      if (pageMarker !== view.getUint32(i))
        continue;

      const pageHeader = new OggPageHeader(view, i);

      if (!idPageFound) {
        if (opusIdHeaderMarker === view.getBigUint64(i + pageHeader.headerSize)) {
          pageHeader.isIdPage = true;
          idPageFound = true;
        }
      } else if (!commentPageFound) {
        if (opusCommentHeaderMarker === view.getBigUint64(i + pageHeader.headerSize)) {
          pageHeader.isCommentPage = true;
          commentPageFound = true;
        }
      } else {
        pageHeader.isAudioPage = true;
      }

      // const { isIdPage, isCommentPage, isAudioPage, isFirstPage, isLastPage, pageSequence, granulePosition} = pageHeader;
      // console.log({
      //               id: Number(isIdPage), 
      //               comment: Number(isCommentPage),
      //               audio: Number(isAudioPage),
      //               first: Number(isFirstPage), 
      //               last: Number(isLastPage), 
      //               page: pageSequence, pos: granulePosition
      //             });

      // skip ahead to next page
      if (pageHeader.pageSize) {
        i+= pageHeader.pageSize-1; // offset for i++
      }

      cb.call(null, { pageHeader })
    }
  }

  parseFile(buffer) {
    const audioPages = [];

    this.scanPages(buffer, onPage);

    if (!audioPages.length) {
      throw Error('Invalid Ogg Opus file.  No audio pages found');
    }

    this.bytes = new Uint8Array(buffer);
    this.headerBytes = new Uint8Array(buffer, 0, audioPages[0]);
    this.audioPageBoundaries = audioPages;

    function onPage({ pageHeader }) {
      if (pageHeader.isAudioPage) {
        audioPages.push(pageHeader.offset)
      }
    }
  }

  // slice Ogg Opus file by audio pages. Mimic prototype of ArrayBuffer.slice(start, end);
  sliceByPage(begin, end) {
    const boundaries = this.audioPageBoundaries;
    const bytesStart = boundaries.hasOwnProperty(begin)? boundaries[begin] : this.bytes.byteLength;
    const bytesEnd = boundaries.hasOwnProperty(end)? boundaries[end] : this.bytes.byteLength;

    // create bytes with header size plus audio pages' size
    const bytes = new Uint8Array(bytesEnd - bytesStart + this.headerBytes.byteLength);

    // add header and audio bytes
    bytes.set(this.headerBytes, 0);
    bytes.set(this.bytes.slice(bytesStart, bytesEnd), this.headerBytes.byteLength);

    return bytes;
  }

  sliceByPercentage(begin, end) {}
  sliceByByte(begin, end) {}
}

