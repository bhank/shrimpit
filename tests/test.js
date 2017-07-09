var Shrimpit = require("../shrimpit");

test("should be able to instantiate Shrimpit", () => {
    expect(new Shrimpit()).toBeDefined();
});

test("test directory a", () => {
    const shrimpit = new Shrimpit();
    shrimpit.exec("./test/a");
    expect(shrimpit.modules.exports).toMatchSnapshot("a exports");
    expect(shrimpit.modules.imports).toMatchSnapshot("a imports");
    expect(shrimpit.getUnresolved()).toMatchSnapshot("a unresolved");
});

test("test directory b", () => {
    const shrimpit = new Shrimpit();
    shrimpit.exec("./test/b");
    expect(shrimpit.modules.exports).toMatchSnapshot("b exports");
    expect(shrimpit.modules.imports).toMatchSnapshot("b imports");
    expect(shrimpit.getUnresolved()).toMatchSnapshot("b unresolved");
});

describe("deExtensionize", () => {
    const shrimpit = new Shrimpit();
    [
        {path: "./dir/subdir/file.ext", expected: "./dir/subdir/file"},
        {path: "./dir/subdir/index.js", expected: "./dir/subdir"},
        {path: "./dir/subdir/", expected: "./dir/subdir"},
        {path: ".\\dir\\subdir\\file.ext", expected: ".\\dir\\subdir\\file"},
        {path: ".\\dir\\subdir\\index.js", expected: ".\\dir\\subdir"},
        {path: ".\\dir\\subdir\\", expected: ".\\dir\\subdir"},
    ].forEach(data => {
        test(`should deExtensionize '${data.path}'`, () => expect(shrimpit.deExtensionize(data.path)).toEqual(data.expected));
    });
});