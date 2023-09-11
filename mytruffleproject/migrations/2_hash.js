const hash = artifacts.require("hash");

module.exports = function (deployer) {
    deployer.deploy(hash);
};