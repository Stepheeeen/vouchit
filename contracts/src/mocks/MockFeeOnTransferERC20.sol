// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev A token that keeps 1% of every transfer, used only by the test-suite.
 *
 * Not a hypothetical: plenty of real tokens do this, and the first escrow
 * contract credited the full stake while receiving less than that. The pot it
 * recorded was larger than the balance it held, so paying a winner reverted
 * for want of funds — permanently, with both stakes inside and no path out.
 * Proven against the old contract: a 20-token pot recorded, 19.8 held,
 * settlement reverting forever.
 *
 * This mock exists so that V2's refusal to accept such a token at the door is
 * demonstrated, not claimed.
 */
contract MockFeeOnTransferERC20 {
    string public name = "Fee Token";
    string public symbol = "FEE";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    uint256 public constant FEE_BPS = 100; // 1%

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 value) external {
        balanceOf[to] += value;
        totalSupply += value;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        return true;
    }

    function _move(address from, address to, uint256 value) internal {
        require(balanceOf[from] >= value, "insufficient balance");
        uint256 fee = (value * FEE_BPS) / 10_000;
        balanceOf[from] -= value;
        balanceOf[to] += value - fee;
        // The fee simply leaves circulation; where it goes is irrelevant here.
        totalSupply -= fee;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(allowance[from][msg.sender] >= value, "insufficient allowance");
        allowance[from][msg.sender] -= value;
        _move(from, to, value);
        return true;
    }
}
