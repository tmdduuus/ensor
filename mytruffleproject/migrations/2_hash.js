const hash = artifacts.require("HashStorage");

module.exports = function (deployer) {
    deployer.deploy(hash);
};