//SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.4.17;

contract HashStorage {
    mapping(bytes32 => bool) public hashDataMap;
    mapping(bytes32 => uint256) public productRating;
    mapping(bytes32 => uint256) public voteNumber;

    string public result = "";
    uint256 public rating = 0;

    function printResult() public view returns (string memory){
        return result;
    }

    function printRating() public view returns (uint256){
        return rating;
    }

    function printVoteNumber(string memory _hash) public view returns (uint256){
        bytes32 hashBytes = keccak256(bytes(_hash));
        return voteNumber[hashBytes];
    }

    function printHello () pure public returns (string memory){
        return "Hello world!";
    }

    function saveHash(string memory _hash) public {
        bytes32 hashBytes = keccak256(bytes(_hash));
        hashDataMap[hashBytes] = true;
        productRating[hashBytes] = 0;
        voteNumber[hashBytes] = 0;
    }

    function checkHash(string memory _hash) public{
        bytes32 hashBytes = keccak256(bytes(_hash));
        if (hashDataMap[hashBytes]) {
            result = "success";
        } else {
            result = "failure";
        }
    }

    function voteProduct(string memory _hash, uint8 rate) public{
        bytes32 hashBytes = keccak256(bytes(_hash));
        if(!hashDataMap[hashBytes]){
            
        }
        productRating[hashBytes] += rate;
        voteNumber[hashBytes]++;

    }

    function getRating(string memory _hash) public {
        bytes32 hashBytes = keccak256(bytes(_hash));
        rating = (productRating[hashBytes] / voteNumber[hashBytes]);
    }

}