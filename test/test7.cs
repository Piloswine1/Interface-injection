using System.wtf;
using System.Collections.Generic;
using System.Linq;
using Antlr4.Runtime;
using HDLTranslator.Compiler.VHDL;
using HDLTranslator.ParserVerilog;

namespace HDLTranslator.Parser.AST.Verilog
{
	/// <summary>
	/// virtual_interface_declaration
	/// </summary>
	public class VerilogVirtualInterfaceDeclaration : IVerilogDataDeclaration// DONE
	{
		public readonly IToken TknInterface;										// DONE
		public readonly VerilogIdentifier Ident;                                    // DONE
		public readonly ImmVec<Tuple<VerilogIdentifier, VerilogIdentifier>> List;   // DONE

		public readonly VerilogStandardVersion VerilogVersion;

		public VerilogVirtualInterfaceDeclaration (IToken tkn, VerilogIdentifier id,
			ImmVec<Tuple<VerilogIdentifier, VerilogIdentifier>> vect)
		{
			TknInterface = tkn;
			Ident = id;
			if (vect?.Length > 0)
				List = vect;
			VerilogVersion = VerilogStandardVersion.Verilog_2005;
		}

		public VerilogVHDLITree Compile()
		{
			VerilogVHDLITree Tuples = null;
			if (List != null)
				Tuples = VerilogVHDLITree.Compile(VerilogSyntaxParser.RULE_list_of_virtual_interface_decl, true, // RULE as in [virtual_interface_declaration] in .g4
					new List<IOldTree>(List.Where(t => t != null).Select(
						t => VerilogVHDLITree.Compile(VerilogSyntaxParser.RULE_dummy_tuple_identifier_and_identifier, true,
							VerilogVHDLITree.Compile(VerilogSyntaxParser.RULE_variable_identifier, true, t.Item1), t.Item2))));

			return VerilogVHDLITree.Compile(VerilogSyntaxParser.RULE_virtual_interface_declaration, true,
				VerilogVHDLITree.Compile(TknInterface, true), Ident, Tuples);
		}
	}
}
