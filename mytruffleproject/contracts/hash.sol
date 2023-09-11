//SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.4.17;

contract HashStorage {
    mapping(bytes32 => bool) public hashDataMap;

    string public result = "";

    function printResult() public view returns (string memory){
        return result;
    }

    function printHello () pure public returns (string memory){
        return "Hello world!";
    }

    function saveHash(string memory _hash) public {
        bytes32 hashBytes = keccak256(bytes(_hash));
        hashDataMap[hashBytes] = true;
    }

    function checkHash(string memory _hash) public{
        bytes32 hashBytes = keccak256(bytes(_hash));
        if (hashDataMap[hashBytes]) {
            result = "success";
        } else {
            result = "failure";
        }
    }

}