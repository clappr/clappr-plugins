var HTML5Audio = require('../../src/playbacks/html5_audio');

describe('HTML5Audio playback', () => {
  it('should check if canPlay resource', () => {
    expect(HTML5Audio.canPlay("")).to.be.false;
    expect(HTML5Audio.canPlay("resource_without_dots")).to.be.false;
    expect(HTML5Audio.canPlay("http://domain.com/Audio.oga")).to.be.true;
    expect(HTML5Audio.canPlay("http://domain.com/Audio.oga?query_string=here")).to.be.true;
    expect(HTML5Audio.canPlay("/relative/Audio.oga")).to.be.true;
  });
})
