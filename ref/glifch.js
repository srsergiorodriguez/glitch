class Glifch {
  /* 
  Glifch
  By Sergio Rodríguez Gómez
  https://github.com/srsergiorodriguez/
  */
  constructor(options = {}) {
    this.colorResolution = Math.max(1, Math.min(7, options.colorResolution || 7));
    this.colorTableSize = Math.pow(2, this.colorResolution + 1);
    this.colorTableBytes = this.colorTableSize * 3;
    this.customPalette = options.customPalette || undefined;
    this.fileName = options.fileName || 'minigif';

    this.delay = options.delay || 50;
    this.transparent = options.transparent || false;
    this.transparentIndex = options.transparentIndex || 0;
    this.dither = options.dither || false;

    this.width;
    this.height;

    this.canvas = undefined;
    this.context = undefined;

    this.globalColorTable;
    this.saturatedColorTable;
    this.framesPixels = [];
    this.framesImageData = [];
    this.allPixels = []; // para poner todos los pixels de todas las imágenes y hacer la quantización

    this.distanceMemo = {};

    // GLITCHES
    this.displaceGlitch = options.displaceGlitch === false ? false : true; // moves the drawing scanlines
    this.patternGlitch = options.patternGlitch === false ? false : true; // replaces parts of code with equivalent patterns
    this.offsetColors = options.offsetColors === false ? false : true;
    this.reSlice = options.reSlice === false ? false : true;
    

    this.saturation = options.saturation || 0;
    this.displaceProb = 0.0002;
    this.patternProb = 0.05;
    this.slices = options.slices || 10;

    this.worker = new Worker("glifch-worker.js");
  }

  async addFrameFromPath(path) {
    const img = new Image();
    img.src = path;
    await new Promise(r => {img.onload = function() {r(true)}});
    this.addFrame(img);
  }

  addFrame(frame) {
    if (frame instanceof HTMLCanvasElement) {
      this.canvas = frame;
      this.context = canvas.getContext("2d", { willReadFrequently: true });
    } else if (frame instanceof HTMLImageElement) {
      const img = frame;

      if (this.canvas === undefined) {
        this.canvas = document.createElement('canvas');
        this.canvas.width  = img.width;
        this.canvas.height = img.height;
        this.context = this.canvas.getContext("2d", { willReadFrequently: true });
      }
      
      this.context.drawImage(img, 0, 0);
      img.remove();
    } else {
      console.error(`Frame must be a canvas or img element.
      If you want to add a frame from an image path use addFrameFromPath async function`);
    }

    if (this.width === undefined || this.height === undefined) {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
    }
  
    const imageDataObject = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageDataObject.data;
    this.framesPixels.push(pixels);

    return pixels
  }

  makeGif() {
    if (this.framesPixels.length === 0) {console.error('Minigif: there are no images to produce the gif'); return}
    
    const nrPixels = this.framesPixels[0].length;
    this.allPixels = new Uint8Array(this.framesPixels.length * nrPixels);
    for (let i = 0; i < this.framesPixels.length; i++) {
      this.allPixels.set(this.framesPixels[i], i * nrPixels);
    }
    
    const colors = this.customPalette || this.medianCutColors(this.allPixels);
        
    this.globalColorTable = this.getColorTable(colors);
    this.saturatedColorTable = this.getColorTable(colors.map(c => this.saturate(c, this.saturation)));
    
    const codeTableData = this.getCodeTable(colors);
    
    this.quantizeFunction = this.dither ? this.errorDiffusionDither : this.simpleQuantize;

    // const maxWorkers = navigator.hardwareConcurrency || 4;
    // const workers = [];
    // for (let i = 0; i < this.framesPixels.length; i++) {
    //   workers[i] = new Worker("glifch-worker.js");
    //   workers[i].onmessage = function(message) {
    //     console.log(message.data);
    //     workers[i].terminate();
    //   }
    // }
    
    for (let i = 0; i < this.framesPixels.length; i++) {
      // worker[i].postMessage("HOLA");

      console.log(`PROCESSING FRAME ${i + 1}`);

      // OFFSETCOLOR GLITCH      
      if (this.offsetColors) this.applyOffsetColors(this.framesPixels[i]); /// 300 ms

      console.time("testData");
      let indexStream = this.quantizeFunction(this.framesPixels[i], this.globalColorTable);
      console.timeEnd("testData");

      // RESLICE GLITCH
      if (this.reSlice) indexStream = this.getReSlice(indexStream, this.slices);
      
      console.time("testStream");
      const codeStream = this.getCodeStream(indexStream, codeTableData);
      console.timeEnd("testStream");

      this.framesImageData[i] = this.getImageData(codeStream);
    }
    const binaryBuffer = this.structureGif();

    /// Canvas cleanup
    this.canvas.remove();
    this.canvas = undefined;
    this.context = undefined;

    return binaryBuffer
  }

  getColorTable(colors) {
    return new Uint8Array(colors.flat());
  }

  getCodeTable(colors) {
    const codeTableDict = {};
    for (let i = 0; i < colors.length; i++) {
      codeTableDict[i] = i;
    }
    codeTableDict[colors.length] = 'CC';
    codeTableDict[colors.length + 1] = 'EOI';
    return {CCindex: colors.length, EOIindex: colors.length + 1, codeTableDict}
  }

  getCodeStream(indexStream, codeTableData) {
    // codifica el indexStream usando el algoritmo LZW y ajusta los tamaños de los códigos variables
    let {CCindex, EOIindex, codeTableDict} = codeTableData;
    const resetCodeTableData = codeTableDict;
    const minimumCodeSize = Math.max(2, this.colorResolution + 1);
    let lastCodeSize;
    let streamStart = 0;

    ///////
    const byteSize = 8;
    const baseSize = 4096;
    let bytesStream = new Uint8Array(baseSize);
    bytesStream[0] = 0;

    let numCount = 0; // counter of current byte being written
    let displace = 0;

    ///////

    function addCode(code, codeSize) {
      if (byteSize)
      while (codeSize > 0) {
        const bitsAvailable = byteSize - displace;
        const bitsToAdd = Math.min(codeSize, bitsAvailable);
        bytesStream[numCount] |= (code & ((1 << bitsToAdd) - 1)) << displace;
        code >>>= bitsToAdd;
        displace = (displace + bitsToAdd) % byteSize;
    
        if (displace === 0) {
          numCount++;
          bytesStream[numCount] = 0;
          if (numCount >= bytesStream.length) {
            const newBytesStream = new Uint8Array(bytesStream.length * 2);
            newBytesStream.set(bytesStream);
            bytesStream = newBytesStream;
          }
        }
    
        codeSize -= bitsToAdd;
      }

      
    }
    /////

    function cloneObj(obj) {  
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(this.cloneObj);
      const clonedObject = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) clonedObject[key] = cloneObj(obj[key]);
      }
      return clonedObject;
    }

    let bufferLengths;
    const nrRandoms = Math.min(10000, indexStream.length / 1000 | 0);
    const drops = new Float32Array(nrRandoms).map(() => Math.random());
    
    addCode(CCindex, minimumCodeSize + 1);
    while (streamStart <= indexStream.length) {
      codeTableDict = cloneObj(resetCodeTableData);

      let currentCodeSize = minimumCodeSize + 1;
      let codeLengthLimit =  (1 << currentCodeSize) + 1; // Equivalent to Math.pow(2, currentCodeSize) + 1;
      let codeLengthCounter = EOIindex;
  
      let indexBuffer = indexStream[streamStart];
      let i = streamStart + 1;

      bufferLengths = {};
      let buffLength = 0;

      const maxLengthCounter = (1 << 12); // Equivalent to Math.pow(2, 12)
      while (codeLengthCounter < maxLengthCounter && i < indexStream.length) {
        const k = indexStream[i];
        const combination = `${indexBuffer},${k}`; // Posible lugar de mejora
        buffLength++;

        if (codeTableDict[combination] !== undefined) {
          indexBuffer = combination;
        } else {
          codeLengthCounter++;
          if (codeLengthCounter >= codeLengthLimit) {
            currentCodeSize++; 
            codeLengthLimit = (1 << currentCodeSize) + 1;
          }
          
          if (bufferLengths[buffLength] === undefined) bufferLengths[buffLength] = [];

          let dictValue;

          if (this.displaceGlitch) {
            const displaceGlitch = drops[i % nrRandoms] < this.displaceProb;
            if (displaceGlitch) {
              const keys = Object.keys(codeTableDict);
              const rnd = (Math.random() * (keys.length - 1)) | 0;
              dictValue = rnd === CCindex || rnd === EOIindex ? codeTableDict[indexBuffer] : codeTableDict[keys[rnd]];
            }
          }
          
          if (this.patternGlitch) {
            const patternGlitch = drops[i + 50 % nrRandoms] < this.patternProb;
            if (patternGlitch) {
              const l = bufferLengths[buffLength].length;
              const rnd = (Math.random() * l) | 0;
              dictValue = l <= 0 ? codeTableDict[indexBuffer] : codeTableDict[bufferLengths[buffLength][rnd]];
            }
          }

          if (dictValue === undefined) dictValue = codeTableDict[indexBuffer];
  
          codeTableDict[combination] = codeLengthCounter;
          bufferLengths[buffLength].push(indexBuffer);
          buffLength = 0;
          addCode(dictValue, currentCodeSize);
          indexBuffer = k;
        }
        i++;
      }

      addCode(codeTableDict[indexBuffer], currentCodeSize);
      streamStart = i;
      if (i >= indexStream.length) {
        lastCodeSize = currentCodeSize;
        break
      }
      addCode(CCindex, currentCodeSize);
    }
    addCode(EOIindex, lastCodeSize);

    return bytesStream.subarray(0, numCount);
  }

  getImageData(bytesStream) {
    // une los bits que tienen largos variables en bytes
    let bytes = bytesStream

    const minimumCodeSize = Math.max(2, this.colorResolution + 1); // LZW minimum code size, esto va primero en el imageData
    // bloques de máximo 255 bytes, antecedidos por el tamaño. Entonces total 256 bytes máx
    const maxBlockSize = 255;
    const divs = bytes.length / maxBlockSize;
    const ceilDivs = Math.ceil(divs); // Número de bloques necesarios
    
    // Tamaño del buffer que es necesario reservar, incluyendo minimumCodeSize, bloques y sus tamaños, y block terminator
    const bufferSize = Math.ceil((divs*(maxBlockSize+1))+2);
    const imageData = new Uint8Array(bufferSize);
    let cursor = 1;

    imageData[0] = minimumCodeSize;
    
    for (let i = 0; i < ceilDivs; i++) {
      let block = bytes.subarray(i * maxBlockSize, (i + 1) * maxBlockSize);
      const blockSize = i < ceilDivs - 1 ? maxBlockSize : block.length;
      imageData.set([blockSize], cursor);
      imageData.set(block, cursor + 1);
      cursor += blockSize + 1;
    }
    // imageData[bufferSize - 1] = 0; // block terminator, esto muestra que terminó el imageData
    imageData[cursor] = 0; // block terminator, esto muestra que terminó el imageData
    return imageData.subarray(0, cursor + 1);
  }

  download(buffer) {
    const blob = new Blob([buffer]);
    const fileName = `${this.fileName}.gif`;
    if (navigator.msSaveBlob) {
      navigator.msSaveBlob(blob, fileName);
    } else {
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }

  structureGif() {
    const packedField = parseInt(`1${this.toBin(this.colorResolution, 3)}0${this.toBin(this.colorResolution,3)}`, 2);
    const header = concatArrayBuffers(
      //header
      rawString('GIF89a'),
      // logical screen descriptor
      U16LE(this.width),
      U16LE(this.height),
      U8(packedField),
      U8(0),
      U8(0)
    );
  
    // global color table here

    const loopRepetitions = 0; // 0 es infinito
    const applicationExtension = concatArrayBuffers(
      U8(33), // 33 (hex 0x21) GIF Extension code
      U8(255), // 255 (hex 0xFF) Application Extension Label
      U8(11), // 11 (hex 0x0B) Length of Application Block
      rawString('NETSCAPE2.0'),
      U8(3), // 3 (hex 0x03) Length of Data Sub-Block
      U8(1), // 1 (hex 0x01)
      U16LE(loopRepetitions),
      U8(0) // terminator
    );

    // PARA CADA IMAGEN DE LA ANIMACIÓN HAY QUE HACER ESTAS TRES: graphicsColorExtension, imageDescriptor, imageData
    const transparentFlag = this.transparent === true ? 1 : 0;
    const disposal = 1; // forma en la que se dibujan las siguientes imágenes 1 es dibujar encima, 2 es borrar el canvas, 3 restore
    const graphicsControlPackedField = parseInt(`00000${disposal}0${transparentFlag}`, 2);
    const imageDescriptorPackedField = parseInt(`00000000`, 2);

    const globalImageData = [];
    for (let i = 0; i < this.framesImageData.length; i++) {

      const graphicsControlExtension = concatArrayBuffers(
        U8(33), // Extension introducer - always 21 hex
        U8(249), // Graphic Control label - always f9 hex
        U8(4), // Byte size
        U8(graphicsControlPackedField),
        U16LE(this.delay), // Delay time
        U8(this.transparentIndex), // Transparent color index
        U8(0) // Block terminator - always 0
      );
      globalImageData.push(graphicsControlExtension);
      
      const imageDescriptor = concatArrayBuffers(
        U8(44), // Image Separator - always 2C hex
        U16LE(0), // Image left,
        U16LE(0), // ImageTop,
        U16LE(this.width), // Width,
        U16LE(this.height), // Height
        U8(imageDescriptorPackedField),
      );

      globalImageData.push(imageDescriptor);

      // image data here
      globalImageData.push(this.framesImageData[i]);
    }
    
    const trailer = new Uint8Array([59]) // 3b hex semicolon indicating end of file

    const gifFile = concatArrayBuffers(
      header,
      this.saturation === 0 ? this.globalColorTable : this.saturatedColorTable,
      applicationExtension,
      ...globalImageData,
      trailer
    );
    
    return gifFile

    // ARRAYBUFFER HELPERS
    function concatArrayBuffers(...bufs){
      const result = new Uint8Array(bufs.reduce((totalSize, buf)=>totalSize+buf.byteLength,0));
      bufs.reduce((offset, buf)=>{
        result.set(buf,offset);
        return offset+buf.byteLength
      },0)
      return result
    }

    function U16LE(v) {
      const bytes = v.toString(2).padStart(16,'0');
      const a = parseInt(bytes.slice(0, 8), 2);
      const b = parseInt(bytes.slice(-8), 2);
      return new Uint8Array([b, a]);
    }

    function U8(v) { return new Uint8Array([v]) }

    function rawString(str) {
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        buffer[i] = str.slice(i, i+1).charCodeAt(0);
      }
      return buffer
    }
  }

  async bufferTobase64(data) {
    const base64url = await new Promise((r) => {
      const reader = new FileReader();
      reader.onload = () => r(reader.result);
      reader.readAsDataURL(new Blob([data]));
    })
    return base64url.split(",", 2)[1];
  }

  async bufferToDataURL(buffer) {
    const base64 = await this.bufferTobase64(buffer);
    const dataURL = "data:image/gif;base64," + base64;
    return dataURL
  }

  /// IMAGE MANIPULATION
  errorDiffusionDither(pixels, colors) {
    const errorDiff = new Int32Array([7, 3, 5, 1]);
    const nIndexes = [[1,0],[-1, 1],[0, 1],[1, 1]];
    const mask = 0b11100000;
    const indexStream = new Uint8Array(pixels.length / 4);
    let cursor = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const currentPixel = [pixels[index] & mask, pixels[index + 1] & mask, pixels[index + 2] & mask];
      const colorIndex = this.findClosest(currentPixel, colors);
      const colorIndexX3 = colorIndex * 3;
      const closest = [colors[colorIndexX3 + 0], colors[colorIndexX3+ 1], colors[colorIndexX3 + 2]];
      const error = this.calculateError(currentPixel, closest);

      pixels[index] = closest[0]; pixels[index + 1] = closest[1]; pixels[index + 2] = closest[2];
      
      const x = (index % this.width) | 0;
      const y = (index / this.width) | 0;
      const lim = x === 0 || x >= this.width - 1;

      for (let j = 0; j < nIndexes.length; j++) {
        if ((lim && j === 1) || (lim && (j === 0 || j === 3))) continue
        const nh = (x + (nIndexes[j][0]) * 4) + ((y + (nIndexes[j][1]) * 4) * this.width);
        pixels[nh] += (error * errorDiff[0]) >> 4; pixels[nh + 1] += (error * errorDiff[1]) >> 4; pixels[nh + 2] += (error * errorDiff[2]) >> 4;
      }
      indexStream[cursor] = colorIndex;
      cursor++;
    }

    return indexStream
  }

  simpleQuantize(pixels, colors) {
    // returns image data object and index stream of colors in color table
    const indexStream = new Uint8Array(pixels.length / 4);
    const mask = 0b11110000;
    let cursor = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const currentPixel = [pixels[index + 0] & mask, pixels[index + 1] & mask, pixels[index + 2] & mask];
      const colorIndex = this.findClosest(currentPixel, colors);
      indexStream[cursor] = colorIndex;
      cursor++;
    }
    return indexStream
  }

  findClosest(c, colors) {
    const cs = this.colorCode(c);
    if (this.distanceMemo[cs] !== undefined) return this.distanceMemo[cs]

    let index = 0;
    let minDistance = Number.MAX_VALUE;
    let count = 0;
    for (let i = 0; i < colors.length; i += 3) {
      const slice = [colors[i + 0], colors[i + 1], colors[i + 2]];
      const distance = this.euclideanDistance(c, slice);
      if (distance < minDistance) {
        minDistance = distance;
        index = count;
      }
      count++;
    }
    this.distanceMemo[cs] = index;
    return index
  }

  colorCode(rgb) {
    const mask = 0xffffff;
    const hex = ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]) & mask;
    return hex
  }

  calculateError(c1, c2) {
    return c1[0] - c2[0] +  c1[1] - c2[1] +  c1[2] - c2[2];
  }

  euclideanDistance(c1, c2) {
    const a = c1[0] - c2[0];
    const b = c1[1] - c2[1];
    const c = c1[2] - c2[2];
    return ((a * a) + (b * b) + (c * c));
  }

  saturate(rgb, value) {
    const gray = 0.2989*rgb[0] + 0.5870*rgb[1] + 0.1140*rgb[2]; //weights from CCIR 601 spec
    const nrgb = [];
    for (let i = 0; i < 3; i++) {
      nrgb[i] = -gray * value + rgb[i] * (1 + value);
      nrgb[i] = nrgb[i] > 255 ? 255 : nrgb[i] < 0 ? 0 : nrgb[i];
    }
    return nrgb
  }

  applyOffsetColors(pixels) {
    const width = this.width;
    for (let i = 0; i < pixels.length; i += 4) {
      const j = i % (width * 4);
      if (j < (width / 10) * 4) {
        pixels[i + j] = pixels[i + j + 4];
      }
    }
  }

  getReSlice(arr, divs) {
    const nrRandoms = Math.max(10, (2 * arr.length / 10) | 0);
    const drops = new Float32Array(nrRandoms).map(() => Math.random() > 0.3);

    const newArr = new Uint8Array(arr.length);
    const chunk = (arr.length / divs) | 0;
    let sect = ((Math.random() * divs) | 0) * chunk;
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      if (count >= chunk) {
        count = 0;
        const div = (Math.random() * (divs / 2)) | 0;
        sect = div  * chunk;
      }
      if (drops[i % nrRandoms]) {
        newArr[i] = arr[sect + count];
      } else {
        newArr[i] = arr[i];
      }
      count++;
    }
    return newArr
  }

  medianCutColors(pixels) {
    const targetBins = this.colorTableSize;
  
    const cols = [];  
    let counter = 0;
    const nrRandoms = Math.max(1000,(2*pixels.length/1000) | 0);
    const drops = new Float32Array(nrRandoms).map(() => Math.random() > 0.02); // Una secuencia de booleanos aleatorios para no calcular tantas veces
    for (let i = 0; i < pixels.length; i+=4) { // crear el primer bin a partir de los pixels
      if (drops[i%nrRandoms]) continue // salta pixels para hacer más pequeña la muestra
      cols[counter] = pixels.subarray(i, i + 3); // Use typed array
      counter++;
    }
  
    // recursion
    const bins = medianCutRecursion([cols], targetBins);
    return averageBins(bins);
  
    function averageBins() {
      const averages = [];
      for (let bin of bins) {
        const channels = {r:[], g:[], b:[]};
        for (let ch of bin) {
          channels.r.push(ch[0]);
          channels.g.push(ch[1]);
          channels.b.push(ch[2]);
        }
        const avg = [stats(channels.r).avg, stats(channels.g).avg, stats(channels.b).avg];
        averages.push(avg);
      }
      return averages
    }
  
    function medianCutRecursion(bins, targetBins) {
      if (bins.length >= targetBins) return bins

      const newBins = [];
      for (let bin of bins) {
        const channels = {r:[], g:[], b:[]};
        for (let ch of bin) {
          channels.r.push(ch[0]);
          channels.g.push(ch[1]);
          channels.b.push(ch[2]);
        }
        const maxRangeI = stats([stats(channels.r).range, stats(channels.g).range, stats(channels.b).range]).maxI; // index of channel with maxrange
        const sorted = bin.sort((a, b)=> a[maxRangeI] - b[maxRangeI]); // ascendente
        const half = (sorted.length/2) | 0;
        newBins.push(
          sorted.slice(0, half), // primera mitad
          sorted.slice(half) // segunda mitad
        )
      }
      return medianCutRecursion(newBins, targetBins);
    }

    function stats(arr) {
      let max = -Number.MAX_VALUE, min = Number.MAX_VALUE;
      let minI = 0, maxI = 0;
      let sum = 0;
      const l = arr.length;
      for (let i = 0; i < l; i++) {
        const e = arr[i];
        sum += e;
        if (max < e) { max = e; maxI = i; }
        if (min > e) { min = e; minI = i; }
      }
      return {min, max, minI, maxI, range: max-min, avg: (sum/l) | 0}
    }
  }

  toBin(v, pad = 0) {return (v).toString(2).padStart(pad,'0')}

}